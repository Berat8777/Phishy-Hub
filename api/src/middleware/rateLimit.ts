import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/response';

/** General limiter applied to the entire /api/v1 surface. */
export const generalRateLimit = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later');
  },
});

/** Strict limiter for /auth/login and /auth/register — brute-force mitigation. */
export const authRateLimit = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Rate-limit by IP + email (when present) so one office IP behind NAT
  // doesn't lock every employee out after a handful of login attempts.
  // ipKeyGenerator() normalizes IPv6 addresses so a single client can't
  // dodge the limit by cycling through addresses in its /64.
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  handler: (_req, res) => {
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Too many attempts, please try again later');
  },
});
