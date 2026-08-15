import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/errors';

/** Terminal middleware for an express-validator chain array — throws AppError on any failed rule. */
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    next(new ValidationError('Validation failed', result.array().map((e) => ({ field: e.type === 'field' ? e.path : e.type, message: e.msg }))));
    return;
  }
  next();
}
