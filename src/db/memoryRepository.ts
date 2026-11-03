import { isChatErrorCode, userMessageFor } from '@/providers/ChatError';

import type { Chat, ChatRepository, ChatSummary, MessagePatch, StoredMessage } from './types';

/**
 * In-memory fake of the repository for Jest. Mirrors the SQLite behaviour: ordering, atomic
 * create, cascade delete, and pending -> error on init.
 */
export class MemoryChatRepository implements ChatRepository {
  chats: Chat[] = [];
  messages: StoredMessage[] = [];
  initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.messages = this.messages.map((m) =>
      m.status === 'pending'
        ? { ...m, status: 'error', errorCode: 'unknown', errorMessage: userMessageFor('unknown') }
        : m,
    );
  }

  async listChats(): Promise<ChatSummary[]> {
    return this.chats
      .map((chat, index) => ({ chat, index }))
      .sort((a, b) => b.chat.updatedAt - a.chat.updatedAt || b.index - a.index)
      .map(({ chat }) => {
        const own = this.messages.filter((m) => m.chatId === chat.id);
        const last = own.reduce<StoredMessage | null>(
          (acc, m) => (acc === null || m.createdAt >= acc.createdAt ? m : acc),
          null,
        );
        return { ...chat, lastMessage: last?.content ?? null };
      });
  }

  async listMessages(chatId: string): Promise<StoredMessage[]> {
    return this.messages
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => m.chatId === chatId)
      .sort((a, b) => a.m.createdAt - b.m.createdAt || a.index - b.index)
      .map(({ m }) => ({ ...m }));
  }

  async createChatWithMessage(chat: Chat, message: StoredMessage): Promise<void> {
    if (this.chats.some((c) => c.id === chat.id)) throw new Error('UNIQUE constraint: chats.id');
    this.chats.push({ ...chat });
    this.messages.push({ ...message });
  }

  async addMessage(message: StoredMessage): Promise<void> {
    const chat = this.chats.find((c) => c.id === message.chatId);
    if (!chat) throw new Error('FOREIGN KEY constraint failed');
    this.messages.push({ ...message });
    chat.updatedAt = message.createdAt;
  }

  async updateMessage(id: string, patch: MessagePatch): Promise<void> {
    this.messages = this.messages.map((m) => {
      if (m.id !== id) return m;
      const next: StoredMessage = { ...m };
      if (patch.content !== undefined) next.content = patch.content;
      if (patch.status !== undefined) next.status = patch.status;
      if ('errorCode' in patch) {
        if (patch.errorCode && isChatErrorCode(patch.errorCode)) next.errorCode = patch.errorCode;
        else delete next.errorCode;
      }
      if ('errorMessage' in patch) {
        if (patch.errorMessage !== undefined) next.errorMessage = patch.errorMessage;
        else delete next.errorMessage;
      }
      return next;
    });
  }

  async renameChat(id: string, title: string): Promise<void> {
    const chat = this.chats.find((c) => c.id === id);
    if (chat) chat.title = title;
  }

  async deleteChat(id: string): Promise<void> {
    this.chats = this.chats.filter((c) => c.id !== id);
    this.messages = this.messages.filter((m) => m.chatId !== id);
  }
}
