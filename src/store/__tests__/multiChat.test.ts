import { MemoryChatRepository } from '@/db';
import { ChatError, type ChatProvider } from '@/providers';

import {
  deleteChat,
  loadChats,
  makeStore,
  openChat,
  renameChat,
  retryMessage,
  selectActiveChat,
  selectChats,
  selectIsChatLoading,
  selectIsSending,
  selectMessages,
  sendMessage,
  startNewChat,
} from '../index';

// A strictly increasing clock, so chats never tie on updatedAt.
let clock = 1_000;
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => ++clock);
});
afterEach(() => jest.restoreAllMocks());

type Send = jest.MockedFunction<ChatProvider['sendMessage']>;

function setup(repo = new MemoryChatRepository()) {
  const sendMock: Send = jest.fn();
  const store = makeStore({ sendMessage: sendMock }, repo);
  return { store, sendMock, repo };
}
type S = ReturnType<typeof setup>['store'];

const flush = () => new Promise((r) => setTimeout(r, 0));
const chats = (store: S) => selectChats(store.getState());
const titles = (store: S) => chats(store).map((c) => c.title);

/** Sends one message that resolves with `reply`, in a new chat. */
async function sendInNewChat(s: ReturnType<typeof setup>, text: string, reply = 'ok') {
  s.store.dispatch(startNewChat());
  s.sendMock.mockResolvedValueOnce(reply);
  await s.store.dispatch(sendMessage(text));
  return chats(s.store)[0]!.id;
}

describe('AC-1: the unsaved new chat', () => {
  it('writes nothing and is not listed until the first message is sent', async () => {
    const { store, repo } = setup();
    await store.dispatch(loadChats());
    store.dispatch(startNewChat());
    expect(chats(store)).toEqual([]);
    expect(repo.chats).toEqual([]);
    expect(repo.messages).toEqual([]);
  });

  it('saves the chat (default model) and the message, and lists the chat on top', async () => {
    const s = setup();
    s.sendMock.mockResolvedValue('answer');
    await s.store.dispatch(sendMessage('hello there'));
    expect(s.repo.chats).toEqual([
      expect.objectContaining({ title: 'hello there', model: 'claude-opus-5-5' }),
    ]);
    expect(s.repo.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'hello there', 'sent'],
      ['assistant', 'answer', 'sent'],
    ]);
    expect(chats(s.store)[0]).toMatchObject({ title: 'hello there', lastMessage: 'answer' });
    expect(selectActiveChat(s.store.getState())?.title).toBe('hello there');
  });

  it('AC-10: New chat while already on an empty new chat changes nothing', async () => {
    const s = setup();
    const before = s.store.getState();
    s.store.dispatch(startNewChat());
    expect(s.store.getState()).toBe(before);
  });

  it('AC-10: an unsent new chat is discarded when opening another chat', async () => {
    const s = setup();
    const first = await sendInNewChat(s, 'first');
    s.store.dispatch(startNewChat());
    await s.store.dispatch(openChat(first));
    expect(chats(s.store)).toHaveLength(1);
    expect(s.repo.chats).toHaveLength(1);
  });
});

describe('AC-2 / AC-4: persistence across restarts', () => {
  it('AC-2: a new store over the same repository lists all chats and loads each history in order', async () => {
    const repo = new MemoryChatRepository();
    const s = setup(repo);
    const a = await sendInNewChat(s, 'chat A', 'reply A');
    const b = await sendInNewChat(s, 'chat B', 'reply B');
    const c = await sendInNewChat(s, 'chat C', 'reply C');
    s.sendMock.mockResolvedValueOnce('reply A2');
    await s.store.dispatch(openChat(a));
    await s.store.dispatch(sendMessage('chat A again'));

    const restarted = setup(repo);
    await restarted.store.dispatch(loadChats());
    expect(titles(restarted.store)).toEqual(['chat A', 'chat C', 'chat B']);
    expect(selectActiveChat(restarted.store.getState())).toBeNull();
    for (const [id, expected] of [
      [a, ['chat A', 'reply A', 'chat A again', 'reply A2']],
      [b, ['chat B', 'reply B']],
      [c, ['chat C', 'reply C']],
    ] as const) {
      await restarted.store.dispatch(openChat(id));
      expect(selectMessages(restarted.store.getState()).map((m) => m.content)).toEqual(expected);
    }
  });

  it('AC-4: a message left pending when the app was killed shows as error after restart', async () => {
    const repo = new MemoryChatRepository();
    const s = setup(repo);
    s.sendMock.mockReturnValue(new Promise(() => undefined)); // the app is killed mid-request
    void s.store.dispatch(sendMessage('stuck'));
    await flush();
    expect(repo.messages[0]?.status).toBe('pending');

    const restarted = setup(repo);
    await restarted.store.dispatch(loadChats());
    await restarted.store.dispatch(openChat(repo.chats[0]!.id));
    expect(selectMessages(restarted.store.getState())[0]).toMatchObject({
      content: 'stuck',
      status: 'error',
    });
    restarted.sendMock.mockResolvedValue('recovered');
    await restarted.store.dispatch(
      retryMessage({ id: selectMessages(restarted.store.getState())[0]!.id }),
    );
    expect(selectMessages(restarted.store.getState()).map((m) => m.status)).toEqual([
      'sent',
      'sent',
    ]);
  });

  it('shows messages as loading while they are read, then the history', async () => {
    const repo = new MemoryChatRepository();
    const s = setup(repo);
    const a = await sendInNewChat(s, 'chat A');
    const restarted = setup(repo);
    await restarted.store.dispatch(loadChats());
    const opening = restarted.store.dispatch(openChat(a));
    expect(selectIsChatLoading(restarted.store.getState())).toBe(true);
    await opening;
    expect(selectIsChatLoading(restarted.store.getState())).toBe(false);
  });
});

describe('AC-3: write-through', () => {
  it('stores pending, then sent plus the reply', async () => {
    const s = setup();
    let resolve: (t: string) => void = () => undefined;
    s.sendMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const done = s.store.dispatch(sendMessage('q'));
    await flush();
    expect(s.repo.messages.map((m) => m.status)).toEqual(['pending']);
    resolve('a');
    await done;
    expect(s.repo.messages.map((m) => m.status)).toEqual(['sent', 'sent']);
  });

  it('stores error with its code and text, then the retry outcome', async () => {
    const s = setup();
    s.sendMock.mockRejectedValueOnce(new ChatError('network'));
    await s.store.dispatch(sendMessage('q'));
    expect(s.repo.messages[0]).toMatchObject({
      status: 'error',
      errorCode: 'network',
      errorMessage: "You're offline. Check your connection and try again.",
    });
    s.sendMock.mockResolvedValueOnce('a');
    await s.store.dispatch(retryMessage({ id: s.repo.messages[0]!.id }));
    expect(s.repo.messages.map((m) => m.status)).toEqual(['sent', 'sent']);
    expect(s.repo.messages[0]).not.toHaveProperty('errorCode');
  });
});

describe('AC-11: ordering', () => {
  it('moves the chat to the top and updates preview and time when a message is sent', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A', 'reply A');
    await sendInNewChat(s, 'B', 'reply B');
    expect(titles(s.store)).toEqual(['B', 'A']);
    await s.store.dispatch(openChat(a));
    s.sendMock.mockResolvedValueOnce('reply A2');
    const before = chats(s.store).find((c) => c.id === a)!.updatedAt;
    await s.store.dispatch(sendMessage('A2'));
    expect(titles(s.store)).toEqual(['A', 'B']);
    const top = chats(s.store)[0]!;
    expect(top.lastMessage).toBe('reply A2');
    expect(top.updatedAt).toBeGreaterThanOrEqual(before);
    expect(s.repo.chats.find((c) => c.id === a)?.updatedAt).toBe(top.updatedAt);
  });
});

describe('AC-13 / AC-14: titles', () => {
  it('AC-13: the title comes from the first prompt only', async () => {
    const s = setup();
    s.sendMock.mockResolvedValue('ok');
    await s.store.dispatch(
      sendMessage('  Plan   a trip to the mountains this coming summer please  '),
    );
    expect(titles(s.store)).toEqual(['Plan a trip to the mountains this coming…']);
    await s.store.dispatch(sendMessage('second'));
    expect(titles(s.store)).toEqual(['Plan a trip to the mountains this coming…']);
  });

  it('AC-14: a renamed chat keeps its title when more messages are sent', async () => {
    const s = setup();
    const id = await sendInNewChat(s, 'original');
    await s.store.dispatch(renameChat(id, 'Mine'));
    s.sendMock.mockResolvedValueOnce('r');
    await s.store.dispatch(sendMessage('more'));
    expect(titles(s.store)).toEqual(['Mine']);
    expect(s.repo.chats[0]?.title).toBe('Mine');
  });
});

describe('rename and delete', () => {
  it('AC-16: rename trims, caps at 60, ignores empty, and does not reorder', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A');
    await sendInNewChat(s, 'B');
    await s.store.dispatch(renameChat(a, `  ${'n'.repeat(70)}  `));
    expect(chats(s.store).find((c) => c.id === a)?.title).toBe('n'.repeat(60));
    expect(chats(s.store).map((c) => c.id)[1]).toBe(a);
    await s.store.dispatch(renameChat(a, '   '));
    expect(chats(s.store).find((c) => c.id === a)?.title).toBe('n'.repeat(60));
    expect(s.repo.chats.find((c) => c.id === a)?.title).toBe('n'.repeat(60));
  });

  it('AC-16: renaming the open chat changes the title the header shows', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'original');
    await s.store.dispatch(renameChat(a, 'Renamed'));
    expect(selectActiveChat(s.store.getState())?.title).toBe('Renamed');
  });

  it('AC-18: a deleted chat stays gone after a restart', async () => {
    const repo = new MemoryChatRepository();
    const s = setup(repo);
    const a = await sendInNewChat(s, 'A');
    await sendInNewChat(s, 'B');
    await s.store.dispatch(deleteChat(a));
    const restarted = setup(repo);
    await restarted.store.dispatch(loadChats());
    expect(titles(restarted.store)).toEqual(['B']);
  });

  it('AC-18: deleting removes the chat and its messages from state and the database', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A');
    const b = await sendInNewChat(s, 'B');
    await s.store.dispatch(deleteChat(a));
    expect(chats(s.store).map((c) => c.id)).toEqual([b]);
    expect(s.repo.chats.map((c) => c.id)).toEqual([b]);
    expect(s.repo.messages.every((m) => m.chatId === b)).toBe(true);
    expect(s.store.getState().chat.messagesByChat[a]).toBeUndefined();
  });

  it('AC-18: deleting the open chat opens a new empty chat; deleting another keeps the open one', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A');
    const b = await sendInNewChat(s, 'B'); // open
    await s.store.dispatch(deleteChat(a));
    expect(selectActiveChat(s.store.getState())?.id).toBe(b);
    await s.store.dispatch(deleteChat(b));
    expect(selectActiveChat(s.store.getState())).toBeNull();
    expect(selectMessages(s.store.getState())).toEqual([]);
  });
});

describe('AC-19: independent chats', () => {
  it("the request contains only the follow-up chat's sent history", async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'question in A', 'answer in A');
    await sendInNewChat(s, 'question in B', 'answer in B');
    await s.store.dispatch(openChat(a));
    s.sendMock.mockResolvedValueOnce('x');
    await s.store.dispatch(sendMessage('follow up in A'));
    const [history, options] = s.sendMock.mock.calls[2]!;
    expect(history).toEqual([
      { role: 'user', content: 'question in A' },
      { role: 'assistant', content: 'answer in A' },
      { role: 'user', content: 'follow up in A' },
    ]);
    expect(options).toMatchObject({ system: 'You are a helpful assistant.' });
  });

  it('a chat opened from the database sends its stored history', async () => {
    const repo = new MemoryChatRepository();
    const s = setup(repo);
    const a = await sendInNewChat(s, 'old q', 'old a');
    await sendInNewChat(s, 'other chat', 'other');
    const restarted = setup(repo);
    await restarted.store.dispatch(loadChats());
    await restarted.store.dispatch(openChat(a));
    restarted.sendMock.mockResolvedValueOnce('new a');
    await restarted.store.dispatch(sendMessage('new q'));
    expect(restarted.sendMock.mock.calls[0]![0].map((m) => m.content)).toEqual([
      'old q',
      'old a',
      'new q',
    ]);
  });
});

describe('AC-20: in-flight replies', () => {
  it('saves a reply to the chat it belongs to while another chat is open, and A shows it later', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A first', 'A reply 1');
    let resolve: (t: string) => void = () => undefined;
    s.sendMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const pending = s.store.dispatch(sendMessage('A slow'));
    await flush();
    expect(selectIsSending(s.store.getState())).toBe(true);

    s.store.dispatch(startNewChat());
    expect(selectIsSending(s.store.getState())).toBe(false);
    s.sendMock.mockResolvedValueOnce('B reply');
    await s.store.dispatch(sendMessage('B first')); // send in B works while A is in flight
    const b = selectActiveChat(s.store.getState())!.id;

    resolve('A late reply');
    await pending;
    expect(selectMessages(s.store.getState()).map((m) => m.content)).toEqual([
      'B first',
      'B reply',
    ]);
    expect(s.repo.messages.filter((m) => m.chatId === b).map((m) => m.content)).toEqual([
      'B first',
      'B reply',
    ]);
    expect(s.repo.messages.filter((m) => m.chatId === a).map((m) => m.content)).toEqual([
      'A first',
      'A reply 1',
      'A slow',
      'A late reply',
    ]);
    await s.store.dispatch(openChat(a));
    expect(selectMessages(s.store.getState()).map((m) => m.content)).toEqual([
      'A first',
      'A reply 1',
      'A slow',
      'A late reply',
    ]);
  });

  it('saves a failure to the chat it belongs to', async () => {
    const s = setup();
    const a = await sendInNewChat(s, 'A first');
    let reject: (e: unknown) => void = () => undefined;
    s.sendMock.mockReturnValueOnce(new Promise((_, r) => (reject = r)));
    const pending = s.store.dispatch(sendMessage('A slow'));
    await flush();
    await sendInNewChat(s, 'B first');
    reject(new ChatError('timeout'));
    await pending;
    expect(selectMessages(s.store.getState()).map((m) => m.status)).toEqual(['sent', 'sent']);
    expect(s.repo.messages.find((m) => m.content === 'A slow')).toMatchObject({
      chatId: a,
      status: 'error',
      errorCode: 'timeout',
    });
  });

  it('a reply for a chat deleted in the meantime is dropped and nothing is written', async () => {
    const s = setup();
    let resolve: (t: string) => void = () => undefined;
    s.sendMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const pending = s.store.dispatch(sendMessage('doomed'));
    await flush();
    const id = chats(s.store)[0]!.id;
    await s.store.dispatch(deleteChat(id));
    resolve('too late');
    await pending;
    expect(chats(s.store)).toEqual([]);
    expect(s.repo.chats).toEqual([]);
    expect(s.repo.messages).toEqual([]);
  });
});
