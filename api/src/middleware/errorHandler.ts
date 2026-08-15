import { NextFunction, Request, Response } from 'express';
import { ValidationError as SequelizeValidationError, UniqueConstraintError } from 'sequelize';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof MulterError) {
    logger.warn({ path: req.path, code: err.code }, 'multer upload error');
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    sendError(res, statusCode, `UPLOAD_${err.code}`, err.message);
    return;
  }

  if (err instanceof UniqueConstraintError) {
    logger.warn({ path: req.path, fields: err.fields }, 'unique constraint violation');
    sendError(res, 409, 'CONFLICT', 'Resource already exists', err.fields);
    return;
  }

  if (err instanceof SequelizeValidationError) {
    logger.warn({ path: req.path }, 'sequelize validation error');
    sendError(
      res,
      422,
      'VALIDATION_ERROR',
      'Validation failed',
      err.errors.map((e) => ({ field: e.path, message: e.message })),
    );
    return;
  }

  const error = err instanceof Error ? err : new Error('Unknown error');
  logger.error({ err: error, path: req.path }, 'unhandled error');
  sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
