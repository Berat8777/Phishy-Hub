import { env } from '../../config/env';
import { AiUnavailableError } from '../../utils/errors';
import { stubProvider } from './generation/stub.provider';
import { getActiveIndexRun } from './retrieval.service';
import type { GenerationProvider } from './generation/types';
import type { AiDocument, AiIndexRun } from '../../models';

/**
 * Provider selection — the central "no ANTHROPIC_API_KEY yet" design
 * constraint (see CONTRACT.md §12 decisions entry). Claude is preferred
 * when its key is set; Gemini (`GEMINI_API_KEY`) is the alternative real
 * provider for whichever key the user actually has. Both real providers are
 * only loaded via dynamic import (they pull their own SDK, no reason to pay
 * that cost when unused), so the server boots and every AI endpoint works
 * today via the stub provider with zero configuration, and upgrades
 * automatically the moment either key is set — no code change, no
 * restart-time branching beyond this function.
 */
export async function getGenerationProvider(): Promise<GenerationProvider> {
  const forced = env.ai.generationProvider;
  const wantsClaude =
    env.ai.enabled && Boolean(env.ai.anthropicApiKey) && (forced === 'auto' || forced === 'claude');
  const wantsGemini =
    env.ai.enabled && !wantsClaude && Boolean(env.ai.geminiApiKey) && (forced === 'auto' || forced === 'gemini');

  if (wantsClaude) {
    // Dynamic `import()` always resolves through Node's ESM loader (even
    // from this CommonJS module), which — unlike `require()` — needs an
    // explicit file extension for relative specifiers; hence `.js` here
    // even though the source file is `claude.provider.ts` (TS's Node16
    // resolution maps it back to the `.ts` file at compile time).
    const { claudeProvider } = await import('./generation/claude.provider.js');
    return claudeProvider;
  }

  if (wantsGemini) {
    const { geminiProvider } = await import('./generation/gemini.provider.js');
    return geminiProvider;
  }

  const stubAllowed = env.ai.enabled && (forced === 'stub' || (forced === 'auto' && !env.isProduction));
  if (stubAllowed) {
    return stubProvider;
  }

  throw new AiUnavailableError();
}

export interface AiIndexRunDTO {
  id: string;
  status: string;
  trigger: string;
  startedById: string | null;
  isActive: boolean;
  embeddingProvider: string | null;
  fileCount: number | null;
  chunkCount: number | null;
  embeddedChunkCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toIndexRunDTO(run: InstanceType<typeof AiIndexRun>): AiIndexRunDTO {
  const json = run.toJSON();
  return {
    id: json.id,
    status: json.status,
    trigger: json.trigger,
    startedById: json.startedById ?? null,
    isActive: json.isActive,
    embeddingProvider: json.embeddingProvider ?? null,
    fileCount: json.fileCount ?? null,
    chunkCount: json.chunkCount ?? null,
    embeddedChunkCount: json.embeddedChunkCount ?? null,
    errorMessage: json.errorMessage ?? null,
    startedAt: json.startedAt ? new Date(json.startedAt).toISOString() : null,
    finishedAt: json.finishedAt ? new Date(json.finishedAt).toISOString() : null,
    createdAt: new Date(json.createdAt).toISOString(),
    updatedAt: new Date(json.updatedAt).toISOString(),
  };
}

export interface AiDocumentDTO {
  id: string;
  path: string;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
  chunkCount: number;
  createdAt: string;
}

export function toDocumentDTO(doc: InstanceType<typeof AiDocument>): AiDocumentDTO {
  const json = doc.toJSON();
  return {
    id: json.id,
    path: json.path,
    language: json.language ?? null,
    sizeBytes: json.sizeBytes,
    lineCount: json.lineCount,
    chunkCount: json.chunkCount,
    createdAt: new Date(json.createdAt).toISOString(),
  };
}

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
  hasApiKey: boolean;
  model: string | null;
  embeddingsEnabled: boolean;
  activeRun: AiIndexRunDTO | null;
}

/** `GET /ai/status` — never returns the key itself, only whether one is configured. */
export async function getAiStatus(): Promise<AiStatus> {
  let provider: string | null = null;
  try {
    provider = (await getGenerationProvider()).name;
  } catch {
    provider = null;
  }
  const activeRun = await getActiveIndexRun();
  const model =
    provider === 'claude' ? env.ai.anthropicModel : provider === 'gemini' ? env.ai.geminiModel : provider === 'stub' ? 'stub' : null;
  return {
    enabled: env.ai.enabled,
    provider,
    hasApiKey: Boolean(env.ai.anthropicApiKey) || Boolean(env.ai.geminiApiKey),
    model,
    embeddingsEnabled: env.ai.embeddingsEnabled,
    activeRun: activeRun ? toIndexRunDTO(activeRun) : null,
  };
}
