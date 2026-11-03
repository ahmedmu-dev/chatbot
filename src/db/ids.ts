import { randomUUID } from 'expo-crypto';

/** uuid v4 for chats and messages. */
export function newId(): string {
  return randomUUID();
}
