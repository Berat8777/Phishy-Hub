import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../config/env';
import { AiUpstreamError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import type { GenerationInput, GenerationProvider } from './types';

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: env.ai.anthropicApiKey });
  }
  return cachedClient;
}

/**
 * Real generation provider — only selected once `ANTHROPIC_API_KEY` is set
 * (see services/ai/index.ts). Drop-in behind the same `GenerationProvider`
 * interface as stub.provider.ts, so nothing else in the AI pipeline changes
 * when the key is added later.
 */
export const claudeProvider: GenerationProvider = {
  name: 'claude',
  async *stream(input: GenerationInput): AsyncIterable<string> {
    try {
      const stream = getClient().messages.stream({
        model: env.ai.anthropicModel,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }

      // Drains the stream fully and throws if the SDK captured a terminal
      // error that didn't surface as a thrown exception from the iteration
      // above (e.g. a stop_reason indicating refusal/error mid-stream).
      await stream.finalMessage();
    } catch (err) {
      logger.warn({ err }, 'ai claude.provider: request failed');
      throw new AiUpstreamError(err instanceof Error ? err.message : 'Claude request failed');
    }
  },
};
