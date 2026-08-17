import type { ApiEnvelope, CursorMeta, PaginationMeta } from './types';
import { ApiError, NetworkError } from './errors';
import * as tokenManager from './tokenManager';
import { API_BASE_URL } from '../config/env';

/**
 * Ported from web/src/api/http.ts. Same envelope-unwrapping + 401 ->
 * refresh -> retry-once discipline (CONTRACT.md §1.3 / repo instructions).
 * React Native's `fetch`/`FormData` are close enough to the browser's that
 * this needed almost no changes beyond reading the base URL from
 * `src/config/env.ts` instead of `import.meta.env`.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-serializable body, or a FormData instance for multipart uploads. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Whether this call is authenticated: attaches `Authorization: Bearer` if a
   * token is present, AND enables the 401 -> refresh -> retry-once flow.
   * `false` for auth/login/auth/register — a 401 there means "wrong
   * password", not "expired session".
   */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta | CursorMeta | Record<string, unknown>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function requestOnce<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
  const authEnabled = options.auth ?? true;
  const headers: Record<string, string> = {};

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
    // Deliberately no Content-Type — RN's fetch sets the multipart boundary
    // itself when the body is a FormData instance, same as web.
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  if (authEnabled) {
    const token = tokenManager.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;

  if (!response.ok || !json || json.success === false) {
    if (json && json.success === false) {
      throw new ApiError(response.status, json.error.code, json.error.message, json.error.details);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Request failed with status ${response.status}`);
  }

  return { data: json.data, meta: json.meta };
}

/**
 * Thin fetch wrapper: unwraps CONTRACT.md's response envelope, throws a
 * typed ApiError on failure, and implements the 401 -> refresh -> retry
 * exactly once flow. Never loops: the retry call below is a plain
 * `requestOnce`, not another `request`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  try {
    return await requestOnce<T>(path, options);
  } catch (err) {
    const authEnabled = options.auth ?? true;
    if (authEnabled && err instanceof ApiError && err.code === 'UNAUTHORIZED') {
      // Shared single-flight refresh (tokenManager.ts) — safe to call even
      // if another caller already kicked one off concurrently.
      await tokenManager.refreshTokens();
      return requestOnce<T>(path, options);
    }
    throw err;
  }
}

export const http = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
