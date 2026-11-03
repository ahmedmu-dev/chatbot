export type ChatErrorCode =
  | 'network'
  | 'rate_limit'
  | 'auth'
  | 'timeout'
  | 'overloaded'
  | 'refused'
  | 'bad_request'
  | 'aborted'
  | 'unknown';

const KNOWN_CODES: readonly ChatErrorCode[] = [
  'network',
  'rate_limit',
  'auth',
  'timeout',
  'overloaded',
  'refused',
  'bad_request',
  'aborted',
  'unknown',
];

export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Try again.';

/** AC-9 user-facing texts. Codes without an entry (bad_request, aborted, unknown) use the fallback. */
export const ERROR_MESSAGES: Partial<Record<ChatErrorCode, string>> = {
  network: "You're offline. Check your connection and try again.",
  rate_limit: 'Too many requests. Wait a moment and try again.',
  auth: "The server couldn't authenticate with the AI provider.",
  timeout: 'The response took too long. Try again.',
  overloaded: 'The AI service is busy. Try again shortly.',
  refused: "This request couldn't be answered.",
};

export function isChatErrorCode(value: unknown): value is ChatErrorCode {
  return KNOWN_CODES.some((code) => code === value);
}

export function userMessageFor(code: ChatErrorCode): string {
  return ERROR_MESSAGES[code] ?? FALLBACK_ERROR_MESSAGE;
}

/** Typed error every provider rejects with. `message` is the text shown to the user. */
export class ChatError extends Error {
  readonly code: ChatErrorCode;

  constructor(code: ChatErrorCode) {
    super(userMessageFor(code));
    this.name = 'ChatError';
    this.code = code;
  }
}

/** Normalises anything thrown into a ChatError (for the Redux layer). */
export function toChatError(err: unknown): ChatError {
  return err instanceof ChatError ? err : new ChatError('unknown');
}
