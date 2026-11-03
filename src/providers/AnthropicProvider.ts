import { ChatError, isChatErrorCode } from './ChatError';
import type { ChatProvider, ProviderMessage, SendOptions } from './ChatProvider';
import { CLIENT_TIMEOUT_MS, getApiUrl } from './config';

function errorCodeFrom(body: unknown): ChatError {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return new ChatError(isChatErrorCode(code) ? code : 'unknown');
}

/** Talks to the local proxy (`server/`), which holds the API key. */
export class AnthropicProvider implements ChatProvider {
  constructor(private readonly timeoutMs: number = CLIENT_TIMEOUT_MS) {}

  async sendMessage(messages: ProviderMessage[], options: SendOptions = {}): Promise<string> {
    const { model, system, signal } = options;
    if (signal?.aborted) throw new ChatError('aborted');

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      let response: Response;
      try {
        response = await fetch(`${getApiUrl()}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, model, system }),
          signal: controller.signal,
        });
      } catch {
        if (timedOut) throw new ChatError('timeout');
        if (signal?.aborted) throw new ChatError('aborted');
        throw new ChatError('network');
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (signal?.aborted && !timedOut) throw new ChatError('aborted');
        throw new ChatError(timedOut ? 'timeout' : 'unknown');
      }

      if (!response.ok) throw errorCodeFrom(body);
      const content = (body as { content?: unknown } | null)?.content;
      if (typeof content !== 'string') throw new ChatError('unknown');
      return content;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}
