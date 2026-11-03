import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';

import type { ErrorCode } from './types';

/** Error with a ready-made AC-6 code. Messages never contain keys or user content. */
export class ProxyError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'ProxyError';
  }
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  auth: 'The AI provider rejected the credentials.',
  rate_limit: 'The AI provider rate limit was hit.',
  overloaded: 'The AI provider is overloaded.',
  timeout: 'The AI provider did not respond in time.',
  network: 'Could not reach the AI provider.',
  refused: 'The request was refused.',
  bad_request: 'The request was invalid.',
  unknown: 'Unexpected server error.',
};

export const HTTP_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  rate_limit: 429,
  refused: 422,
  auth: 502,
  network: 502,
  overloaded: 503,
  timeout: 504,
  unknown: 500,
};

/** Maps any thrown value to an AC-6 code using the SDK's typed classes only (no message matching). */
export function toProxyError(err: unknown): ProxyError {
  if (err instanceof ProxyError) return err;
  // Timeout is a subclass of connection error, so check it first.
  if (err instanceof APIConnectionTimeoutError) return new ProxyError('timeout');
  if (err instanceof APIConnectionError) return new ProxyError('network');
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new ProxyError('auth');
  }
  if (err instanceof RateLimitError) return new ProxyError('rate_limit');
  if (err instanceof BadRequestError) return new ProxyError('bad_request');
  if (err instanceof APIError) {
    const status = err.status;
    if (status === 529 || (status !== undefined && status >= 500)) {
      return new ProxyError('overloaded');
    }
    if (status !== undefined && status >= 400) return new ProxyError('bad_request');
  }
  return new ProxyError('unknown');
}
