import { env } from '../../config/env';

/**
 * Small in-memory token bucket keyed by userId — used only by
 * aiMention.service.ts (the `@ai` chat-mention path bypasses Express
 * entirely, since it's triggered from inside message creation, not an HTTP
 * request), sharing the same budget (`AI_RATE_LIMIT_MAX`/`AI_RATE_LIMIT_WINDOW_MS`)
 * as `POST /ai/query`'s real `express-rate-limit` middleware
 * (middleware/rateLimit.ts::aiQueryRateLimit). Single-process, in-memory —
 * same scaling assumption as sockets/handlers/presence.handler.ts.
 */
interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function consumeAiRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = env.ai.rateLimitWindowMs;
  const max = env.ai.rateLimitMax;

  const bucket = buckets.get(userId);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
