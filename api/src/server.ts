import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { sequelize, assertDatabaseConnection } from './config/database';
import { ensureBucket } from './config/minio';
import { initSockets } from './sockets';
import { logger } from './utils/logger';

/**
 * Non-fatal sanity checks for the two config mistakes most likely to
 * silently break a distributed demo (architecture doc §7, risk #1 and #4):
 * a MinIO public endpoint that only resolves on this machine, and a CORS
 * origin that was never pointed at the actual client host.
 */
function warnAboutDemoDayConfig(): void {
  if (['localhost', '127.0.0.1', '::1'].includes(env.minio.publicEndpoint)) {
    logger.warn(
      { minioPublicEndpoint: env.minio.publicEndpoint },
      'MINIO_PUBLIC_ENDPOINT is set to a loopback address — presigned download URLs will only work from THIS machine. ' +
        'Set it to this machine\'s LAN IP before connecting from other computers (see CONTRACT.md §5).',
    );
  }
  if (env.corsOrigin === '*') {
    logger.warn(
      'CORS_ORIGIN is "*" — fine for a quick local demo, but every origin can call this API and Socket.IO with credentials. ' +
        'Set it to the actual client origin(s) for anything beyond a single-machine test.',
    );
  }
}

async function bootstrap(): Promise<void> {
  warnAboutDemoDayConfig();

  await assertDatabaseConnection();
  logger.info('Database connection OK');

  await ensureBucket();
  logger.info('MinIO bucket ready');

  const app = createApp();
  const httpServer = http.createServer(app);

  // Sockets must be wired before we start accepting connections so
  // getIo() is never called before ioInstance is set.
  initSockets(httpServer);
  logger.info('Socket.IO initialized');

  httpServer.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'API server listening');
  });

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully...');

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    httpServer.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error while closing HTTP server');
      }
      try {
        await sequelize.close();
        logger.info('Database connection closed');
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Error while closing database connection');
      }
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
