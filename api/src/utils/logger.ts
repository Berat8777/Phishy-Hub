import pino from 'pino';
import { env } from '../config/env';

/**
 * Paths pino will replace with "[Redacted]" instead of logging verbatim.
 * Wildcards (`*`) cover both array items (req headers, body arrays) and
 * unknown object keys. Keep this list in sync with any new field that
 * carries a credential/secret/token.
 */
const REDACT_PATHS = [
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  '*.password',
  '*.passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'tokenHash',
  '*.accessToken',
  '*.refreshToken',
  '*.token',
  '*.tokenHash',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: REDACT_PATHS,
    censor: '[Redacted]',
  },
});
