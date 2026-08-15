import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { generalRateLimit } from './middleware/rateLimit';
import healthRoutes from './routes/health.routes';
import apiRoutes from './routes/index';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const allowedOrigins = env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim());

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  // Unversioned health check (no rate limit — used by process monitors).
  app.use(healthRoutes);

  // Versioned API surface, general rate limit applies from here down.
  app.use('/api/v1', generalRateLimit, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
