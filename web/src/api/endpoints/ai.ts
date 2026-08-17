import { http } from '../http';
import type { AiCitation, AiIndexRunDTO, AiQueryDTO, AiQueryStatus, AiSearchHit, AiStatusDTO, PaginationMeta } from '../types';

/**
 * Thin wrappers around `/api/v1/ai/*` (Phase 6 / Module 7). Response shapes
 * mirror the fixed contract given to this pass — see the doc comment at the
 * top of the AI section in `../types.ts`.
 */

export function getStatus(): Promise<AiStatusDTO> {
  return http.get<AiStatusDTO>('/ai/status').then((r) => r.data);
}

/**
 * `POST /ai/query`. `stream` defaults to `true` server-side (CONTRACT-given
 * shape) — when streaming, only `{queryId, status, citations}` come back
 * here, and the answer text arrives incrementally via the `ai:answer:*`
 * socket events (see `stores/ai.ts`). When `stream: false`, `answer` is
 * populated immediately instead.
 */
export interface AiQueryResponse {
  queryId: string;
  status?: AiQueryStatus;
  answer?: string;
  citations: AiCitation[];
}

export function query(input: {
  question: string;
  channelId?: string;
  parentQueryId?: string;
  stream?: boolean;
}): Promise<AiQueryResponse> {
  return http.post<AiQueryResponse>('/ai/query', input).then((r) => r.data);
}

/** `GET /ai/queries` — own queries by default; admin may pass `userId` to view another user's. */
export function listQueries(params?: {
  userId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AiQueryDTO[]; meta: PaginationMeta }> {
  return http
    .get<AiQueryDTO[]>('/ai/queries', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

export function getQuery(queryId: string): Promise<AiQueryDTO> {
  return http.get<AiQueryDTO>(`/ai/queries/${queryId}`).then((r) => r.data);
}

/** `POST /ai/search` — pure retrieval, no streaming/socket involved. */
export function search(input: { q: string; limit?: number }): Promise<AiSearchHit[]> {
  return http.post<AiSearchHit[]>('/ai/search', input).then((r) => r.data);
}

/** `POST /ai/index` — admin only. Kicks off a new index run, returns the created (pending/running) run row. */
export function triggerIndex(): Promise<AiIndexRunDTO> {
  return http.post<AiIndexRunDTO>('/ai/index').then((r) => r.data);
}

/** `GET /ai/index/status` — latest run + currently-active run (if any), distinct from the `activeRun` embedded in `AiStatusDTO`. */
export interface AiIndexStatusResponse {
  latest: AiIndexRunDTO | null;
  active: AiIndexRunDTO | null;
}

export function getIndexStatus(): Promise<AiIndexStatusResponse> {
  return http.get<AiIndexStatusResponse>('/ai/index/status').then((r) => r.data);
}

/** `GET /ai/index/runs` — admin only, paginated. */
export function listIndexRuns(params?: { page?: number; pageSize?: number }): Promise<{
  items: AiIndexRunDTO[];
  meta: PaginationMeta;
}> {
  return http
    .get<AiIndexRunDTO[]>('/ai/index/runs', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}

/**
 * `GET /ai/documents` — admin only, `?q=` + paginated. Matches
 * `toDocumentDTO` in `api/src/services/ai/index.ts`. Not currently wired
 * into any view (see HANDOFF).
 */
export interface AiDocumentDTO {
  id: string;
  path: string;
  language: string | null;
  sizeBytes: number;
  lineCount: number;
  chunkCount: number;
  createdAt: string;
}

export function listDocuments(params?: { q?: string; page?: number; pageSize?: number }): Promise<{
  items: AiDocumentDTO[];
  meta: PaginationMeta;
}> {
  return http
    .get<AiDocumentDTO[]>('/ai/documents', { query: params })
    .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta }));
}
