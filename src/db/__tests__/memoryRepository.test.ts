import { MemoryChatRepository } from '../memoryRepository';
import type { Chat, StoredMessage } from '../types';

const chat = (id: string, updatedAt: number): Chat => ({
  id,
  title: `Chat ${id}`,
  model: 'claude-opus-5-5',
  createdAt: updatedAt,
  updatedAt,
});
const msg = (id: string, chatId: string, createdAt: number, extra: Partial<StoredMessage> = {}) =>
  ({
    id,
    chatId,
    role: 'user',
    content: `text ${id}`,
    status: 'sent',
    createdAt,
    ...extra,
  }) as StoredMessage;

describe('MemoryChatRepository', () => {
  it('AC-1: stores a chat with its first message and lists it with a preview', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('m1', 'a', 1));
    const list = await repo.listChats();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'a', model: 'claude-opus-5-5', lastMessage: 'text m1' });
  });

  it('AC-2: lists chats newest updatedAt first and messages oldest first', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('a1', 'a', 1));
    await repo.createChatWithMessage(chat('b', 2), msg('b1', 'b', 2));
    await repo.addMessage(msg('a2', 'a', 3, { role: 'assistant' }));
    expect((await repo.listChats()).map((c) => c.id)).toEqual(['a', 'b']);
    expect((await repo.listMessages('a')).map((m) => m.id)).toEqual(['a1', 'a2']);
    expect((await repo.listChats())[0]).toMatchObject({ updatedAt: 3, lastMessage: 'text a2' });
  });

  it('AC-3: updateMessage persists status and error changes without touching updatedAt', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('m1', 'a', 1, { status: 'pending' }));
    await repo.updateMessage('m1', { status: 'error', errorCode: 'network', errorMessage: 'off' });
    expect((await repo.listMessages('a'))[0]).toMatchObject({
      status: 'error',
      errorCode: 'network',
      errorMessage: 'off',
    });
    await repo.updateMessage('m1', {
      status: 'pending',
      errorCode: undefined,
      errorMessage: undefined,
    });
    const [m] = await repo.listMessages('a');
    expect(m?.status).toBe('pending');
    expect(m).not.toHaveProperty('errorCode');
    expect((await repo.listChats())[0]?.updatedAt).toBe(1);
  });

  it('AC-4: init turns pending messages into error', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('m1', 'a', 1, { status: 'pending' }));
    await repo.init();
    expect((await repo.listMessages('a'))[0]).toMatchObject({
      status: 'error',
      errorCode: 'unknown',
    });
    expect((await repo.listMessages('a'))[0]?.errorMessage).toBeTruthy();
  });

  it('AC-14: rename changes the title but not the order', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('a1', 'a', 1));
    await repo.createChatWithMessage(chat('b', 2), msg('b1', 'b', 2));
    await repo.renameChat('a', 'New name');
    const list = await repo.listChats();
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
    expect(list[1]?.title).toBe('New name');
  });

  it('AC-18: deleting a chat removes its messages too', async () => {
    const repo = new MemoryChatRepository();
    await repo.createChatWithMessage(chat('a', 1), msg('a1', 'a', 1));
    await repo.createChatWithMessage(chat('b', 2), msg('b1', 'b', 2));
    await repo.deleteChat('a');
    expect((await repo.listChats()).map((c) => c.id)).toEqual(['b']);
    expect(await repo.listMessages('a')).toEqual([]);
    expect(await repo.listMessages('b')).toHaveLength(1);
  });

  it('rejects a message for an unknown chat', async () => {
    const repo = new MemoryChatRepository();
    await expect(repo.addMessage(msg('x', 'nope', 1))).rejects.toThrow();
  });
});
