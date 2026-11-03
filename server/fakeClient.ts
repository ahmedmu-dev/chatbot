import { ProxyError } from './errors';
import type { CompleteParams, ErrorCode, LlmClient } from './types';

const FAIL_CODES: readonly ErrorCode[] = [
  'auth',
  'rate_limit',
  'overloaded',
  'timeout',
  'network',
  'refused',
  'bad_request',
];

/**
 * Deterministic backend for E2E tests and demos (LLM_PROVIDER=fake). No key, no network.
 * Reply format:
 *   You said: <last user message>
 *   Earlier messages: none | <n>
 *   - <earlier user message> ...
 * A last user message containing `[fail:<code>]` fails with that AC-6 error.
 */
export class FakeClient implements LlmClient {
  async complete({ messages }: CompleteParams): Promise<string> {
    const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const last = users[users.length - 1] ?? '';
    const match = /\[fail:([a-z_]+)\]/.exec(last);
    const code = FAIL_CODES.find((c) => c === match?.[1]);
    if (code) throw new ProxyError(code);
    const earlier = users.slice(0, -1);
    const lines = [
      `You said: ${last}`,
      earlier.length === 0 ? 'Earlier messages: none' : `Earlier messages: ${earlier.length}`,
      ...earlier.map((m) => `- ${m}`),
    ];
    return lines.join('\n');
  }
}
