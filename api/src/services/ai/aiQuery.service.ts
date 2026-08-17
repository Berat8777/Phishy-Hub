import { AiQuery } from '../../models';
import { AppError, AiNotIndexedError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { getActiveIndexRun, retrieveContext, type RetrievedBlock } from './retrieval.service';
import { getGenerationProvider } from './index';
import { paginate, PaginationParams } from '../pagination.service';
import type { UserRole } from '../../utils/constants';
import type { AiQueryCitation } from '../../models/aiQuery.model';

/** Resource-level RBAC gate for every AI entry point (REST + the `@ai` chat mention). */
export function assertCanUseAi(role: UserRole): void {
  if (!env.ai.allowedRoles.includes(role)) {
    throw new ForbiddenError('Your role is not allowed to use the AI assistant');
  }
}

export type AiEmitEvent =
  | {
      event: 'ai:answer:start';
      payload: { queryId: string; channelId?: string; messageId?: string; citations: AiQueryCitation[] };
    }
  | { event: 'ai:answer:delta'; payload: { queryId: string; delta: string } }
  | {
      event: 'ai:answer:done';
      payload: { queryId: string; answer: string; citations: AiQueryCitation[]; messageId?: string };
    }
  | { event: 'ai:answer:error'; payload: { queryId: string; code: string; message: string } };

/**
 * Injected by the caller (controller / aiMention.service.ts) rather than
 * imported from sockets/index here — same discipline message.service.ts
 * documents for itself ("no sockets dependency").
 */
export type AiEmitFn = (event: AiEmitEvent) => void;

const SYSTEM_PROMPT =
  'You are the Phishy Hub internal AI code assistant. Answer using ONLY the provided code context blocks. ' +
  'Cite files as path:startLine-endLine when referencing them. If the context does not contain the answer, ' +
  'say so plainly instead of guessing. Answer in the same language the question was asked in.';

function buildUserPrompt(question: string, blocks: RetrievedBlock[]): string {
  const contextSection = blocks.map((b) => `### ${b.path}:${b.startLine}-${b.endLine}\n${b.content}`).join('\n\n');
  return `Question: ${question}\n\nContext:\n${contextSection || '(no matching context found)'}`;
}

function toCitations(blocks: RetrievedBlock[]): AiQueryCitation[] {
  return blocks.map((b) => ({
    documentId: b.documentId,
    path: b.path,
    startLine: b.startLine,
    endLine: b.endLine,
    heading: b.heading,
    score: b.score,
    referenced: false,
  }));
}

/**
 * Full query orchestration: retrieval -> generation -> persistence, emitting
 * `ai:answer:*` events as it goes (see CONTRACT.md §4.3). Used by both
 * `POST /ai/query` and the `@ai` chat-mention flow
 * (services/ai/aiMention.service.ts) — the only difference between them is
 * what `emit` does and whether `channelId`/`messageId` are set.
 */
export async function answerQuestion(input: {
  userId: string;
  role: UserRole;
  question: string;
  channelId?: string | null;
  messageId?: string | null;
  parentQueryId?: string | null;
  emit: AiEmitFn;
}): Promise<InstanceType<typeof AiQuery>> {
  assertCanUseAi(input.role);

  const activeRun = await getActiveIndexRun();
  if (!activeRun) {
    throw new AiNotIndexedError();
  }

  const question = input.question.trim();
  const query = await AiQuery.create({
    userId: input.userId,
    parentQueryId: input.parentQueryId ?? null,
    channelId: input.channelId ?? null,
    messageId: input.messageId ?? null,
    indexRunId: activeRun.id,
    question,
    provider: 'pending',
    status: 'pending',
    citations: [],
  });

  const startedAt = Date.now();

  try {
    const provider = await getGenerationProvider();
    const blocks = await retrieveContext(question);
    const citations = toCitations(blocks);

    await query.update({ status: 'streaming', provider: provider.name });

    input.emit({
      event: 'ai:answer:start',
      payload: {
        queryId: query.id,
        channelId: input.channelId ?? undefined,
        messageId: input.messageId ?? undefined,
        citations,
      },
    });

    let answer = '';
    for await (const delta of provider.stream({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(question, blocks),
      maxTokens: env.ai.anthropicMaxTokens,
    })) {
      answer += delta;
      input.emit({ event: 'ai:answer:delta', payload: { queryId: query.id, delta } });
    }

    // A citation counts as "referenced" once the model's answer literally
    // mentions its path:line — cheap, good-enough signal for which context
    // blocks actually mattered (no second LLM call to judge relevance).
    const finalCitations = citations.map((c) => ({
      ...c,
      referenced: answer.includes(`${c.path}:${c.startLine}`),
    }));

    const latencyMs = Date.now() - startedAt;
    await query.update({
      status: 'succeeded',
      answer,
      citations: finalCitations,
      model: provider.name === 'claude' ? env.ai.anthropicModel : null,
      latencyMs,
    });

    input.emit({
      event: 'ai:answer:done',
      payload: { queryId: query.id, answer, citations: finalCitations, messageId: input.messageId ?? undefined },
    });

    return query;
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : 'AI query failed';
    logger.warn({ err, queryId: query.id }, 'ai aiQuery.service: answerQuestion failed');
    await query.update({ status: 'failed', errorCode: code, latencyMs: Date.now() - startedAt });
    input.emit({ event: 'ai:answer:error', payload: { queryId: query.id, code, message } });
    throw err;
  }
}

/** `GET /ai/queries` — own queries, or (admin only) another user's via `?userId=`. */
export async function listQueriesForUser(
  callerId: string,
  role: UserRole,
  params: PaginationParams & { userId?: string },
) {
  const targetUserId = role === 'admin' && params.userId ? params.userId : callerId;
  return paginate(AiQuery, params, { where: { userId: targetUserId } });
}

/** `GET /ai/queries/:id` — owner or admin only. */
export async function getQueryForUser(
  id: string,
  callerId: string,
  role: UserRole,
): Promise<InstanceType<typeof AiQuery>> {
  const query = await AiQuery.findByPk(id);
  if (!query) throw new NotFoundError('AI query not found');
  if (query.userId !== callerId && role !== 'admin') {
    throw new ForbiddenError('You do not have access to this AI query');
  }
  return query;
}
