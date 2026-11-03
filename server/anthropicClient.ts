import Anthropic from '@anthropic-ai/sdk';

import { ProxyError } from './errors';
import type { CompleteParams, LlmClient } from './types';

export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MAX_TOKENS = 16000;
export const REQUEST_TIMEOUT_MS = 60_000;
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export class AnthropicClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    // No SDK retries: the 60 s budget in AC-6 is for the whole call.
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  }

  async complete({ messages, model, system }: CompleteParams): Promise<string> {
    const response = await this.client.beta.messages.create({
      model: model ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Thinking cannot be disabled on Opus 5.5, so keep it cheap for chat.
      output_config: { effort: 'low' },
      fallbacks: 'default',
      betas: [FALLBACK_BETA],
      ...(system ? { system } : {}),
      messages,
    });
    if (response.stop_reason === 'refusal') throw new ProxyError('refused');
    return response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
  }
}
