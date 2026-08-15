import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import type { UserRole } from '../utils/constants';

/** Coarse, global RBAC gate. Resource-level checks live in services/authz.service.ts. */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}
