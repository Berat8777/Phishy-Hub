import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Client-initiated socket events reply via an ack callback shaped like
 * `{success, data|error}` — see architecture doc §4. This is the socket
 * equivalent of utils/response.ts's REST envelope.
 */
export interface AckSuccess<T> {
  success: true;
  data: T;
}

export interface AckFailure {
  success: false;
  error: { code: string; message: string };
}

export type AckResponse<T> = AckSuccess<T> | AckFailure;

export function ackSuccess<T>(data: T): AckSuccess<T> {
  return { success: true, data };
}

export function ackError(err: unknown): AckFailure {
  if (err instanceof AppError) {
    return { success: false, error: { code: err.code, message: err.message } };
  }
  const error = err instanceof Error ? err : new Error('Unknown error');
  logger.error({ err: error }, 'unhandled socket handler error');
  return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } };
}
