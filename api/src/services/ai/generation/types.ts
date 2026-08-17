export interface GenerationInput {
  system: string;
  user: string;
  maxTokens: number;
}

export interface GenerationProvider {
  name: string;
  stream(input: GenerationInput): AsyncIterable<string>;
}
