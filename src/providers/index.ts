import { AnthropicProvider } from './AnthropicProvider';
import type { ChatProvider } from './ChatProvider';

export { AnthropicProvider } from './AnthropicProvider';
export { ChatError, toChatError, userMessageFor } from './ChatError';
export type { ChatErrorCode } from './ChatError';
export type { ChatProvider, ChatRole, ProviderMessage, SendOptions } from './ChatProvider';

/** The provider the app uses. Swap here to add another backend. */
export const chatProvider: ChatProvider = new AnthropicProvider();
