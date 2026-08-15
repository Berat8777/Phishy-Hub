import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { UnauthorizedError } from '../utils/errors';
import type { UserRole } from '../utils/constants';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role as UserRole, orgId: payload.orgId };
    next();
  } catch (err) {
    next(err);
  }
}
