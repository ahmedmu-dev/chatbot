/** @jest-environment node */
import { APIConnectionError, APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk';
import request from 'supertest';

import { AnthropicClient } from '../anthropicClient';
import { createApp } from '../app';

const mockCreate = jest.fn();
let mockCtorArgs: unknown;
jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  class MockAnthropic {
    beta = { messages: { create: mockCreate } };
    constructor(args: unknown) {
      mockCtorArgs = args;
    }
  }
  return { ...actual, __esModule: true, default: MockAnthropic };
});

const FAKE_KEY = 'test-key-not-real';
const app = createApp(new AnthropicClient(FAKE_KEY));
const history = [
  { role: 'user', content: 'first question' },
  { role: 'assistant', content: 'first answer' },
  { role: 'user', content: 'second question' },
];

function apiError(status: number): Error {
  return APIError.generate(status, { type: 'error' }, 'upstream said secret text', new Headers());
}

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('US-2 proxy server', () => {
  it('AC-4: GET /health returns 200 {"ok":true}', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  describe('AC-5: POST /api/chat', () => {
    it('sends system + messages in order and returns the assistant text', async () => {
      mockCreate.mockResolvedValue({
        stop_reason: 'end_turn',
        content: [
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'there' },
        ],
      });
      const res = await request(app)
        .post('/api/chat')
        .send({ messages: history, system: 'Be nice.' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ content: 'Hello there' });
      const args = mockCreate.mock.calls[0]![0];
      expect(args.system).toBe('Be nice.');
      expect(args.messages).toEqual(history);
    });

    it('uses claude-opus-5-5, low effort, 16000 tokens and the server-side fallback', async () => {
      mockCreate.mockResolvedValue({ stop_reason: 'end_turn', content: [] });
      await request(app).post('/api/chat').send({ messages: history });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-5-5',
          max_tokens: 16000,
          output_config: { effort: 'low' },
          fallbacks: 'default',
          betas: ['server-side-fallback-2026-07-01'],
        }),
      );
      expect(mockCtorArgs).toEqual({ apiKey: FAKE_KEY, timeout: 60000, maxRetries: 0 });
    });

    it('passes a requested model through', async () => {
      mockCreate.mockResolvedValue({ stop_reason: 'end_turn', content: [] });
      await request(app).post('/api/chat').send({ messages: history, model: 'claude-haiku-5-5' });
      expect(mockCreate.mock.calls[0]![0].model).toBe('claude-haiku-5-5');
    });
  });

  describe('AC-6: error mapping', () => {
    const cases: [string, () => Error, number, string][] = [
      ['401 -> auth', () => apiError(401), 502, 'auth'],
      ['403 -> auth', () => apiError(403), 502, 'auth'],
      ['429 -> rate_limit', () => apiError(429), 429, 'rate_limit'],
      ['529 -> overloaded', () => apiError(529), 503, 'overloaded'],
      ['500 -> overloaded', () => apiError(500), 503, 'overloaded'],
      ['503 -> overloaded', () => apiError(503), 503, 'overloaded'],
      ['SDK timeout -> timeout', () => new APIConnectionTimeoutError(), 504, 'timeout'],
      [
        'connection failure -> network',
        () => new APIConnectionError({ cause: new Error('ECONNREFUSED') }),
        502,
        'network',
      ],
      ['400 -> bad_request', () => apiError(400), 400, 'bad_request'],
    ];
    it.each(cases)('%s', async (_name, make, status, code) => {
      mockCreate.mockRejectedValue(make());
      const res = await request(app).post('/api/chat').send({ messages: history });
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(typeof res.body.error.message).toBe('string');
    });

    it('stop_reason refusal -> refused', async () => {
      mockCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });
      const res = await request(app).post('/api/chat').send({ messages: history });
      expect(res.status).not.toBe(200);
      expect(res.body.error.code).toBe('refused');
    });

    it.each([
      ['missing messages', {}],
      ['empty messages', { messages: [] }],
      ['bad role', { messages: [{ role: 'system', content: 'x' }] }],
      ['empty content', { messages: [{ role: 'user', content: '  ' }] }],
      ['non-string model', { messages: history, model: 5 }],
    ])('invalid body (%s) -> bad_request without calling the API', async (_n, body) => {
      const res = await request(app).post('/api/chat').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('bad_request');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('malformed JSON -> bad_request', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Content-Type', 'application/json')
        .send('{nope');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('bad_request');
    });

    it('never leaks the key, upstream text or message contents in responses or logs', async () => {
      mockCreate.mockRejectedValue(apiError(401));
      const res = await request(app)
        .post('/api/chat')
        .send({ messages: [{ role: 'user', content: 'my private question' }] });
      const logged = JSON.stringify(jest.mocked(console.error).mock.calls);
      for (const text of [JSON.stringify(res.body), logged]) {
        expect(text).not.toContain(FAKE_KEY);
        expect(text).not.toContain('my private question');
        expect(text).not.toContain('secret text');
      }
    });
  });
});
