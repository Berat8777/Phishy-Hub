import { Request, Response } from 'express';
import { Op } from 'sequelize';
import * as aiService from '../services/ai';
import * as aiQueryService from '../services/ai/aiQuery.service';
import * as retrievalService from '../services/ai/retrieval.service';
import * as indexingService from '../services/ai/indexing.service';
import { AiDocument, AiIndexRun } from '../models';
import { getIo } from '../sockets';
import { broadcastAiIndexProgress } from '../sockets/broadcast';
import { logger } from '../utils/logger';
import { parsePaginationQuery, paginate } from '../services/pagination.service';
import { sendSuccess } from '../utils/response';
import type { AiEmitFn } from '../services/ai/aiQuery.service';
import type { IndexProgress } from '../services/ai/indexing.service';

function tryGetIo() {
  try {
    return getIo();
  } catch {
    return null;
  }
}

export async function status(req: Request, res: Response): Promise<void> {
  const aiStatus = await aiService.getAiStatus();
  sendSuccess(res, aiStatus);
}

/**
 * `POST /ai/query`. Streaming mode (`stream !== false`, the default): waits
 * only until the first `ai:answer:start` event (retrieval done, generation
 * about to begin) to respond `201`, then lets generation keep running in the
 * background — the answer itself arrives via `ai:answer:delta`/`ai:answer:done`
 * socket events (CONTRACT.md §4.3). Non-streaming mode waits for the whole
 * thing and returns the final answer in the response body.
 */
export async function query(req: Request, res: Response): Promise<void> {
  const { question, channelId, parentQueryId } = req.body as {
    question: string;
    channelId?: string;
    parentQueryId?: string;
  };
  const shouldStream = req.body.stream !== false;
  const userId = req.user!.id;

  if (!shouldStream) {
    const result = await aiQueryService.answerQuestion({
      userId,
      role: req.user!.role,
      question,
      channelId: channelId ?? null,
      parentQueryId: parentQueryId ?? null,
      emit: () => {},
    });
    sendSuccess(res, { queryId: result.id, answer: result.answer, citations: result.citations }, 201);
    return;
  }

  const io = tryGetIo();
  let responded = false;

  await new Promise<void>((resolve, reject) => {
    const emit: AiEmitFn = (evt) => {
      if (io) {
        try {
          io.to(`user:${userId}`).emit(evt.event, evt.payload);
        } catch (err) {
          logger.debug({ err }, 'ai controller: failed to emit ai:answer event');
        }
      }
      if (!responded && evt.event === 'ai:answer:start') {
        responded = true;
        sendSuccess(res, { queryId: evt.payload.queryId, status: 'streaming', citations: evt.payload.citations }, 201);
        resolve();
      }
    };

    aiQueryService
      .answerQuestion({ userId, role: req.user!.role, question, channelId: channelId ?? null, parentQueryId: parentQueryId ?? null, emit })
      .catch((err) => {
        if (!responded) {
          responded = true;
          reject(err);
        } else {
          logger.warn({ err }, 'ai controller: streaming answerQuestion failed after response was already sent');
        }
      });
  });
}

export async function listQueries(req: Request, res: Response): Promise<void> {
  const { items, meta } = await aiQueryService.listQueriesForUser(req.user!.id, req.user!.role, {
    ...parsePaginationQuery(req.query),
    userId: req.query.userId as string | undefined,
  });
  sendSuccess(
    res,
    items.map((q) => q.toJSON()),
    200,
    meta,
  );
}

export async function getQuery(req: Request, res: Response): Promise<void> {
  const result = await aiQueryService.getQueryForUser(req.params.id as string, req.user!.id, req.user!.role);
  sendSuccess(res, result.toJSON());
}

export async function search(req: Request, res: Response): Promise<void> {
  const { q, limit } = req.body as { q: string; limit?: number };
  const blocks = await retrievalService.retrieveContext(q, limit);
  sendSuccess(
    res,
    blocks.map((b) => ({
      path: b.path,
      startLine: b.startLine,
      endLine: b.endLine,
      heading: b.heading,
      content: b.content,
      score: b.score,
    })),
  );
}

export async function startIndex(req: Request, res: Response): Promise<void> {
  const startedById = req.user!.id;
  const run = await indexingService.beginIndexRun({ trigger: 'api', startedById });

  const io = tryGetIo();
  const onProgress = (progress: IndexProgress) => {
    if (!io) return;
    try {
      broadcastAiIndexProgress(io, startedById, progress);
    } catch (err) {
      logger.debug({ err }, 'ai controller: failed to emit ai:index:progress');
    }
  };

  // Fire-and-forget: the heavy walk/chunk/embed work continues after we respond.
  void indexingService.executeIndexRun(run, onProgress).catch((err) => {
    logger.error({ err, runId: run.id }, 'ai controller: background index run failed unexpectedly');
  });

  sendSuccess(res, aiService.toIndexRunDTO(run), 201);
}

export async function indexStatus(_req: Request, res: Response): Promise<void> {
  const [latest, active] = await Promise.all([
    AiIndexRun.findOne({ order: [['createdAt', 'DESC']] }),
    retrievalService.getActiveIndexRun(),
  ]);
  sendSuccess(res, {
    latest: latest ? aiService.toIndexRunDTO(latest) : null,
    active: active ? aiService.toIndexRunDTO(active) : null,
  });
}

export async function listIndexRuns(req: Request, res: Response): Promise<void> {
  const { items, meta } = await paginate(AiIndexRun, parsePaginationQuery(req.query), {});
  sendSuccess(
    res,
    items.map((r) => aiService.toIndexRunDTO(r)),
    200,
    meta,
  );
}

export async function listDocuments(req: Request, res: Response): Promise<void> {
  const active = await retrievalService.getActiveIndexRun();
  if (!active) {
    const { page, pageSize } = parsePaginationQuery(req.query);
    sendSuccess(res, [], 200, { page: page ?? 1, pageSize: pageSize ?? 20, total: 0, totalPages: 1 });
    return;
  }

  const { q, ...pagination } = parsePaginationQuery(req.query);
  const where: Record<string, unknown> = { indexRunId: active.id };
  if (q) where.path = { [Op.iLike]: `%${q}%` };

  const { items, meta } = await paginate(AiDocument, pagination, { where }, 'path');
  sendSuccess(
    res,
    items.map((d) => aiService.toDocumentDTO(d)),
    200,
    meta,
  );
}
