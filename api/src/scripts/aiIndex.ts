import { sequelize } from '../models';
import { runIndex } from '../services/ai/indexing.service';
import { logger } from '../utils/logger';

/**
 * `npm run ai:index` — standalone CLI entry point for the indexing pipeline,
 * separate from the `POST /ai/index` REST endpoint (which fires the same
 * `services/ai/indexing.service.ts` but doesn't await full completion). Runs
 * with `trigger: 'script'` (see `ai_index_runs.trigger`) and no `startedById`
 * (no authenticated user in this context, so no `ai:index:progress` socket
 * target either — progress is just logged).
 */
async function main(): Promise<void> {
  await sequelize.authenticate();
  logger.info('ai:index — database connection OK, starting index run');

  const run = await runIndex({
    trigger: 'script',
    onProgress: (progress) => {
      logger.info(progress, 'ai:index — progress');
    },
  });

  logger.info(
    {
      runId: run.id,
      status: run.status,
      fileCount: run.fileCount,
      chunkCount: run.chunkCount,
      embeddedChunkCount: run.embeddedChunkCount,
      embeddingProvider: run.embeddingProvider,
      errorMessage: run.errorMessage,
    },
    'ai:index — finished',
  );

  await sequelize.close();
  process.exit(run.status === 'succeeded' ? 0 : 1);
}

main().catch((err) => {
  logger.error({ err }, 'ai:index — fatal error');
  process.exit(1);
});
