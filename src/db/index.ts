import { SqliteChatRepository } from './sqliteRepository';
import type { ChatRepository } from './types';

export type * from './types';
export { MemoryChatRepository } from './memoryRepository';
export { SqliteChatRepository } from './sqliteRepository';

/** The repository the app uses. */
export const chatRepository: ChatRepository = new SqliteChatRepository();
