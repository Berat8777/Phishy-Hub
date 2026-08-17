import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * `@huggingface/transformers` is ESM-only — loaded via dynamic `import()`
 * from this CommonJS module, same pattern as `file-type` in
 * services/file.service.ts (see CONTRACT.md §9 deviation #2).
 */
type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: 'mean' | 'cls' | 'none'; normalize: boolean },
) => Promise<{ tolist?: () => number[][] } | number[][]>;

let pipelinePromise: Promise<FeatureExtractionPipeline | null> | null = null;

/**
 * Lazily loads the local embedding model. If loading fails for ANY reason
 * (native binding failure, no network access to download model weights,
 * unsupported platform, ...) this logs a warning and resolves to `null`
 * exactly once — every caller for the rest of the process lifetime then
 * treats embeddings as disabled instead of retrying (a load failure here is
 * essentially always environmental and won't spontaneously resolve).
 * Indexing runs must NEVER fail because of this — see indexing.service.ts.
 */
function loadPipeline(): Promise<FeatureExtractionPipeline | null> {
  if (!env.ai.embeddingsEnabled) {
    return Promise.resolve(null);
  }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformers: any = await import('@huggingface/transformers');
        const extractor = await transformers.pipeline('feature-extraction', env.ai.embeddingModel);
        logger.info({ model: env.ai.embeddingModel }, 'ai embedding.service: local embedding model loaded');
        return extractor as FeatureExtractionPipeline;
      } catch (err) {
        logger.warn(
          { err, model: env.ai.embeddingModel },
          'ai embedding.service: failed to load local embedding model — continuing with embeddings disabled for this process',
        );
        return null;
      }
    })();
  }
  return pipelinePromise;
}

export async function embeddingsAvailable(): Promise<boolean> {
  return (await loadPipeline()) !== null;
}

const BATCH_SIZE = 16;

/**
 * Embeds `texts` in batches of 16, returning one 384-float vector (or
 * `null` if embedding is unavailable/failed for that batch) per input, in
 * the same order. Never throws — a batch failure degrades to `null` entries
 * rather than aborting the whole run.
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const extractor = await loadPipeline();
  if (!extractor) return texts.map(() => null);

  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const rows: number[][] = typeof (output as { tolist?: () => number[][] }).tolist === 'function'
        ? (output as { tolist: () => number[][] }).tolist()
        : (output as number[][]);
      for (const row of rows) {
        results.push(Array.from(row));
      }
    } catch (err) {
      logger.warn({ err, batchSize: batch.length }, 'ai embedding.service: batch embedding failed — leaving these chunks unembedded');
      for (let j = 0; j < batch.length; j++) results.push(null);
    }
  }
  return results;
}
