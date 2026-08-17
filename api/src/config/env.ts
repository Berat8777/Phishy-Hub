import 'dotenv/config';
import path from 'path';

/**
 * Reads and validates process.env once at startup. Fails fast (throws
 * synchronously, which crashes the process before it ever binds a port) if
 * a required variable is missing or malformed, instead of letting a typo'd
 * env var surface as a confusing runtime error later.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function requiredInt(name: string): number {
  const raw = required(name);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return value;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

const nodeEnv = optional('NODE_ENV', 'development');

const jwtAccessSecret = required('JWT_ACCESS_SECRET');
const jwtRefreshSecret = required('JWT_REFRESH_SECRET');
if (jwtAccessSecret === jwtRefreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
}
if (nodeEnv === 'production') {
  if (jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters in production');
  }
  if (jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: optionalInt('PORT', 3000),
  corsOrigin: optional('CORS_ORIGIN', '*'),

  db: {
    host: required('DB_HOST'),
    port: requiredInt('DB_PORT'),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    logging: optionalBool('DB_LOGGING', false),
  },

  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  bcryptRounds: optionalInt('BCRYPT_ROUNDS', 12),

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 60_000),
    max: optionalInt('RATE_LIMIT_MAX', 300),
    authWindowMs: optionalInt('AUTH_RATE_LIMIT_WINDOW_MS', 60_000),
    authMax: optionalInt('AUTH_RATE_LIMIT_MAX', 10),
  },

  minio: {
    internalEndpoint: required('MINIO_INTERNAL_ENDPOINT'),
    internalPort: requiredInt('MINIO_INTERNAL_PORT'),
    publicEndpoint: required('MINIO_PUBLIC_ENDPOINT'),
    publicPort: requiredInt('MINIO_PUBLIC_PORT'),
    useSSL: optionalBool('MINIO_USE_SSL', false),
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
    bucket: required('MINIO_BUCKET'),
  },

  maxUploadSizeMb: optionalInt('MAX_UPLOAD_SIZE_MB', 25),
  signedUrlExpirySeconds: optionalInt('SIGNED_URL_EXPIRY_SECONDS', 900),

  logLevel: optional('LOG_LEVEL', 'info'),

  // --- AI RAG code assistant (Module 7) — ALL optional, server boots with none set. ---
  ai: {
    anthropicApiKey: optional('ANTHROPIC_API_KEY', ''),
    anthropicModel: optional('ANTHROPIC_MODEL', 'claude-sonnet-4-5'),
    anthropicMaxTokens: optionalInt('ANTHROPIC_MAX_TOKENS', 2048),
    // Alternative generation provider — used when no ANTHROPIC_API_KEY is
    // set but a Gemini key is (see services/ai/index.ts's selection order).
    geminiApiKey: optional('GEMINI_API_KEY', ''),
    geminiModel: optional('GEMINI_MODEL', 'gemini-3.6-flash'),
    enabled: optionalBool('AI_ENABLED', true),
    // 'auto' | 'stub' | 'claude' | 'gemini' — see services/ai/index.ts for the selection logic.
    generationProvider: optional('AI_GENERATION_PROVIDER', 'auto'),
    // Repo root — this file lives at api/src/config/env.ts, so 3 levels up
    // reaches the repo root (api/src/config -> api/src -> api -> repo root).
    indexRoot: optional('AI_INDEX_ROOT', path.resolve(__dirname, '../../..')),
    embeddingsEnabled: optionalBool('AI_EMBEDDINGS_ENABLED', true),
    embeddingModel: optional('AI_EMBEDDING_MODEL', 'Xenova/all-MiniLM-L6-v2'),
    retrievalTopK: optionalInt('AI_RETRIEVAL_TOP_K', 8),
    contextMaxChars: optionalInt('AI_CONTEXT_MAX_CHARS', 24000),
    chunkMaxLines: optionalInt('AI_CHUNK_MAX_LINES', 40),
    chunkOverlapLines: optionalInt('AI_CHUNK_OVERLAP_LINES', 10),
    maxFileBytes: optionalInt('AI_MAX_FILE_BYTES', 262144),
    allowedRoles: optional('AI_ALLOWED_ROLES', 'developer,sales,admin')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
    rateLimitMax: optionalInt('AI_RATE_LIMIT_MAX', 10),
    rateLimitWindowMs: optionalInt('AI_RATE_LIMIT_WINDOW_MS', 60_000),
  },
};

export type Env = typeof env;
