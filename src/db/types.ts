import type { ChatErrorCode } from '@/providers';

export type MessageStatus = 'pending' | 'sent' | 'error';
export type MessageRole = 'user' | 'assistant';

export interface Chat {
  id: string;
  title: string;
  model: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch ms of the latest message in the chat. Rename does not change it. */
  updatedAt: number;
}

/** A chat plus the raw text of its last message (null if it has none), for the drawer. */
export interface ChatSummary extends Chat {
  lastMessage: string | null;
}

export interface StoredMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  errorCode?: ChatErrorCode;
  errorMessage?: string;
  createdAt: number;
}

export type MessagePatch = Partial<
  Pick<StoredMessage, 'content' | 'status' | 'errorCode' | 'errorMessage'>
>;

/**
 * All persistence goes through this interface. Thunks and tests never touch SQLite directly.
 */
export interface ChatRepository {
  /** Creates the schema (user_version 1) and turns leftover `pending` messages into `error` (AC-4). */
  init(): Promise<void>;
  /** Newest `updatedAt` first. No messages are loaded. */
  listChats(): Promise<ChatSummary[]>;
  /** Oldest first. */
  listMessages(chatId: string): Promise<StoredMessage[]>;
  /** Saves a brand-new chat together with its first message, atomically (AC-1). */
  createChatWithMessage(chat: Chat, message: StoredMessage): Promise<void>;
  /** Adds a message and moves the chat's `updatedAt` to the message's `createdAt`. */
  addMessage(message: StoredMessage): Promise<void>;
  /** Changes status/error/content of a message. Does not touch `updatedAt`. */
  updateMessage(id: string, patch: MessagePatch): Promise<void>;
  renameChat(id: string, title: string): Promise<void>;
  /** Removes the chat; its messages go with it (ON DELETE CASCADE). */
  deleteChat(id: string): Promise<void>;
}
