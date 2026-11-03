import { AnthropicProvider } from '../AnthropicProvider';
import { ChatError } from '../ChatError';

const messages = [{ role: 'user' as const, content: 'hi' }];
const mockFetch = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function rejection(promise: Promise<unknown>): Promise<ChatError> {
  try {
    await promise;
  } catch (err) {
    return err as ChatError;
  }
  throw new Error('expected rejection');
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('US-3 AnthropicProvider', () => {
  it('AC-8: posts to the default http://localhost:8787/api/chat and resolves with the text', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { content: 'Hello!' }));
    const text = await new AnthropicProvider().sendMessage(messages, {
      model: 'claude-opus-5-5',
      system: 'Be brief.',
    });
    expect(text).toBe('Hello!');
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:8787/api/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      messages,
      model: 'claude-opus-5-5',
      system: 'Be brief.',
    });
  });

  it('AC-8: uses EXPO_PUBLIC_API_URL when set', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:8787/';
    mockFetch.mockResolvedValue(jsonResponse(200, { content: 'ok' }));
    await new AnthropicProvider().sendMessage(messages);
    expect(mockFetch.mock.calls[0]![0]).toBe('http://10.0.2.2:8787/api/chat');
  });

  describe('AC-9: proxy error codes map to user messages', () => {
    it.each([
      ['network', "You're offline. Check your connection and try again."],
      ['rate_limit', 'Too many requests. Wait a moment and try again.'],
      ['auth', "The server couldn't authenticate with the AI provider."],
      ['timeout', 'The response took too long. Try again.'],
      ['overloaded', 'The AI service is busy. Try again shortly.'],
      ['refused', "This request couldn't be answered."],
      ['bad_request', 'Something went wrong. Try again.'],
      ['unknown', 'Something went wrong. Try again.'],
      ['totally_new_code', 'Something went wrong. Try again.'],
    ])('%s', async (code, message) => {
      mockFetch.mockResolvedValue(jsonResponse(503, { error: { code, message: 'x' } }));
      const err = await rejection(new AnthropicProvider().sendMessage(messages));
      expect(err).toBeInstanceOf(ChatError);
      expect(err.message).toBe(message);
      expect(err.code).toBe(code === 'totally_new_code' ? 'unknown' : code);
    });
  });

  it('AC-9: a non-JSON response rejects with a generic ChatError', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    const err = await rejection(new AnthropicProvider().sendMessage(messages));
    expect(err).toMatchObject({ code: 'unknown', message: 'Something went wrong. Try again.' });
  });

  it('AC-9: a 200 without text content rejects with a generic ChatError', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { nope: true }));
    const err = await rejection(new AnthropicProvider().sendMessage(messages));
    expect(err.code).toBe('unknown');
  });

  it('AC-9/AC-17: a fetch failure (offline) rejects with the offline message', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    const err = await rejection(new AnthropicProvider().sendMessage(messages));
    expect(err).toMatchObject({
      code: 'network',
      message: "You're offline. Check your connection and try again.",
    });
  });

  it('AC-9: no response within the client timeout rejects with the timeout message', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const pending = rejection(new AnthropicProvider(1000).sendMessage(messages));
      await jest.advanceTimersByTimeAsync(1000);
      expect(await pending).toMatchObject({
        code: 'timeout',
        message: 'The response took too long. Try again.',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('AC-9: an already aborted signal rejects without calling fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await rejection(
      new AnthropicProvider().sendMessage(messages, { signal: controller.signal }),
    );
    expect(err).toMatchObject({ code: 'aborted', message: 'Something went wrong. Try again.' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('AC-9: aborting while in flight rejects with an aborted ChatError', async () => {
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const controller = new AbortController();
    const pending = rejection(
      new AnthropicProvider().sendMessage(messages, { signal: controller.signal }),
    );
    controller.abort();
    expect(await pending).toMatchObject({ code: 'aborted' });
  });
});
