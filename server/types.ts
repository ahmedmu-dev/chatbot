export type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface CompleteParams {
  messages: ChatMessage[];
  model?: string;
  system?: string;
}

/** One LLM backend. `complete` resolves with the assistant text or throws (see errors.ts). */
export interface LlmClient {
  complete(params: CompleteParams): Promise<string>;
}

export type ErrorCode =
  | 'auth'
  | 'rate_limit'
  | 'overloaded'
  | 'timeout'
  | 'network'
  | 'refused'
  | 'bad_request'
  | 'unknown';
