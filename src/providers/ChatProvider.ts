export type ChatRole = 'user' | 'assistant';

export interface ProviderMessage {
  role: ChatRole;
  content: string;
}

export interface SendOptions {
  model?: string;
  system?: string;
  signal?: AbortSignal;
}

/** One LLM backend. Rejects with a ChatError. Other providers or streaming can implement this later. */
export interface ChatProvider {
  sendMessage(messages: ProviderMessage[], options?: SendOptions): Promise<string>;
}
