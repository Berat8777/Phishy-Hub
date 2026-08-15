import { Response } from 'express';

/**
 * Standard response envelope shared by every REST endpoint. Documented in
 * CONTRACT.md — do not change shape without updating that doc.
 *
 * Success: { success: true, data, meta? }
 * Error:   { success: false, error: { code, message, details? } }
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta | Record<string, unknown>,
): Response {
  return res.status(statusCode).json(meta !== undefined ? { success: true, data, meta } : { success: true, data });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return res.status(statusCode).json({
    success: false,
    error: details !== undefined ? { code, message, details } : { code, message },
  });
}
