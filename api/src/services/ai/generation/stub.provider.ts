import type { GenerationInput, GenerationProvider } from './types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deterministic, offline generation provider used whenever no Anthropic API
 * key is configured (the default in this environment today — see
 * services/ai/index.ts for selection logic). Synthesizes an answer purely
 * from the retrieved context blocks embedded in `input.user` by
 * aiQuery.service.ts, streamed word-by-word so the exact same streaming
 * plumbing (sockets, DB persistence, citation matching) is exercised
 * end-to-end without ever calling out to a real model.
 */
export const stubProvider: GenerationProvider = {
  name: 'stub',
  async *stream(input: GenerationInput): AsyncIterable<string> {
    const answer = synthesizeAnswer(input.user);
    const words = answer.split(/(\s+)/); // keep whitespace tokens so join is lossless
    for (const word of words) {
      yield word;
      await delay(15);
    }
  },
};

/**
 * `input.user` is aiQuery.service.ts's prompt, which embeds retrieved
 * context blocks as `### path:startLine-endLine\n<content>` sections
 * (see buildUserPrompt there). This parses those back out so the stub can
 * quote real citations instead of hallucinating.
 */
function synthesizeAnswer(userPrompt: string): string {
  const blockRegex = /### ([^\n]+)\n([\s\S]*?)(?=\n### |\n?$)/g;
  const citations: { label: string; firstLines: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(userPrompt)) !== null) {
    const label = match[1].trim();
    const contentLines = match[2].trim().split('\n').slice(0, 2).join(' ').trim();
    citations.push({ label, firstLines: contentLines.slice(0, 160) });
  }

  if (citations.length === 0) {
    return (
      'Bu soruyla ilgili indekslenmiş kod içinde bir eşleşme bulamadım. ' +
      '(Not: bu yanıt yerel stub sağlayıcı tarafından üretildi — gerçek bir dil modeli çağrılmadı, ' +
      'çünkü ANTHROPIC_API_KEY tanımlı değil.)'
    );
  }

  const lines = [
    'İlgili kod parçaları:',
    ...citations.map((c) => `- ${c.label}: ${c.firstLines || '(boş satır)'}`),
    '',
    '(Not: bu yanıt yerel stub sağlayıcı tarafından üretildi — gerçek bir dil modeli çağrılmadı, ' +
      'çünkü ANTHROPIC_API_KEY tanımlı değil. Yukarıdaki alıntılar retrieval.service.ts tarafından bulundu.)',
  ];
  return lines.join('\n');
}
