/**
 * Error codes are a fixed string enum per CONTRACT.md §0 — branch on `code`,
 * never on `message` (message is human-readable and may change across
 * versions).
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'UPLOAD_LIMIT_FILE_SIZE'
  | 'INTERNAL_ERROR'
  | (string & {});

/**
 * Thrown by http.ts for every non-2xx response, and by anything else in the
 * transport layer that needs to surface a CONTRACT-shaped error. Carries the
 * envelope's `code` (for programmatic branching) and `message` (for display)
 * rather than just an HTTP status, per CONTRACT.md §0.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Raised when the transport layer can't reach the server at all (offline, DNS, CORS, etc). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
