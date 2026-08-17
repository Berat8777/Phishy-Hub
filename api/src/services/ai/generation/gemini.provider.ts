import { env } from '../../../config/env';
import { AiUpstreamError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import type { GenerationInput, GenerationProvider } from './types';
// `@google/genai` is ESM-only — same dynamic-import requirement as
// `@huggingface/transformers` (see embedding.service.ts) and
// `file-type` v22 (CONTRACT.md §9.2): a static `import` here fails to
// compile under this project's CommonJS module setting.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleGenAIClient = any;

let cachedClient: GoogleGenAIClient | null = null;

async function getClient(): Promise<GoogleGenAIClient> {
  if (!cachedClient) {
    const { GoogleGenAI } = await import('@google/genai');
    cachedClient = new GoogleGenAI({ apiKey: env.ai.geminiApiKey });
  }
  return cachedClient;
}

/**
 * Alternative real generation provider (Google Gemini) — selected instead
 * of claude.provider.ts when only `GEMINI_API_KEY` is set (see
 * services/ai/index.ts). Same `GenerationProvider` seam, so nothing else in
 * the AI pipeline (retrieval, chat integration, streaming, web UI) branches
 * on which upstream is actually in use.
 */
export const geminiProvider: GenerationProvider = {
  name: 'gemini',
  async *stream(input: GenerationInput): AsyncIterable<string> {
    try {
      const client = await getClient();
      const response = await client.models.generateContentStream({
        model: env.ai.geminiModel,
        contents: input.user,
        config: {
          systemInstruction: input.system,
          maxOutputTokens: input.maxTokens,
        },
      });

      for await (const chunk of response) {
        if (chunk.text) yield chunk.text;
      }
    } catch (err) {
      logger.warn({ err }, 'ai gemini.provider: request failed');
      throw new AiUpstreamError(err instanceof Error ? err.message : 'Gemini request failed');
    }
  },
};
