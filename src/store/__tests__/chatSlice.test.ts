import { ChatError, type ChatProvider } from '@/providers';

import { MemoryChatRepository } from '@/db';

import {
  makeStore,
  retryMessage,
  selectIsSending,
  selectMessages,
  sendMessage,
  startNewChat,
} from '../index';

type Send = jest.MockedFunction<ChatProvider['sendMessage']>;

function setup() {
  const sendMock: Send = jest.fn();
  const repo = new MemoryChatRepository();
  const store = makeStore({ sendMessage: sendMock }, repo);
  return { store, sendMock, repo };
}

const messagesOf = (store: ReturnType<typeof makeStore>) => selectMessages(store.getState());
const isSending = (store: ReturnType<typeof makeStore>) => selectIsSending(store.getState());
const SYSTEM = 'You are a helpful assistant.';

describe('Redux chat slice', () => {
  it('AC-12: the user message shows as pending immediately, then sent with the reply after it', async () => {
    const { store, sendMock } = setup();
    let resolve: (text: string) => void = () => undefined;
    sendMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const done = store.dispatch(sendMessage('hello'));
    expect(messagesOf(store)).toMatchObject([
      { role: 'user', content: 'hello', status: 'pending' },
    ]);
    expect(isSending(store)).toBe(true);
    resolve('hi there');
    await done;
    expect(messagesOf(store)).toMatchObject([
      { role: 'user', content: 'hello', status: 'sent' },
      { role: 'assistant', content: 'hi there', status: 'sent' },
    ]);
    expect(isSending(store)).toBe(false);
  });

  it('AC-20: the request has the system prompt, earlier sent messages oldest first, then the new one', async () => {
    const { store, sendMock } = setup();
    sendMock.mockResolvedValueOnce('answer 1').mockResolvedValueOnce('answer 2');
    await store.dispatch(sendMessage('question 1'));
    await store.dispatch(sendMessage('question 2'));
    expect(sendMock).toHaveBeenNthCalledWith(1, [{ role: 'user', content: 'question 1' }], {
      system: SYSTEM,
      signal: expect.any(AbortSignal),
    });
    expect(sendMock.mock.calls[1]![0]).toEqual([
      { role: 'user', content: 'question 1' },
      { role: 'assistant', content: 'answer 1' },
      { role: 'user', content: 'question 2' },
    ]);
    expect(sendMock.mock.calls[1]![1]).toMatchObject({ system: SYSTEM });
  });

  it('AC-21: asking "what did I just ask?" includes the earlier question', async () => {
    const { store, sendMock } = setup();
    sendMock.mockResolvedValue('ok');
    await store.dispatch(sendMessage('capital of France?'));
    await store.dispatch(sendMessage('what did I just ask?'));
    const history = sendMock.mock.calls[1]![0];
    expect(history.map((m) => m.content)).toContain('capital of France?');
    expect(history[history.length - 1]).toEqual({ role: 'user', content: 'what did I just ask?' });
  });

  it('AC-22: after New chat the request contains no messages from the previous chat', async () => {
    const { store, sendMock } = setup();
    sendMock.mockResolvedValue('ok');
    await store.dispatch(sendMessage('old question'));
    store.dispatch(startNewChat());
    await store.dispatch(sendMessage('what did I just ask?'));
    expect(sendMock.mock.calls[1]![0]).toEqual([{ role: 'user', content: 'what did I just ask?' }]);
  });

  it('S01 AC-19 (S02 AC-10): New chat shows an empty conversation; the old chat stays saved', async () => {
    const { store, sendMock } = setup();
    sendMock.mockResolvedValue('ok');
    await store.dispatch(sendMessage('hi'));
    store.dispatch(startNewChat());
    expect(messagesOf(store)).toEqual([]);
    expect(isSending(store)).toBe(false);
    expect(store.getState().chat.chats).toHaveLength(1);
  });

  it('S01 AC-19 (S02 AC-20): a reply that arrives after New chat lands in its own chat only', async () => {
    const { store, sendMock } = setup();
    let resolve: (text: string) => void = () => undefined;
    sendMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const done = store.dispatch(sendMessage('hi'));
    store.dispatch(startNewChat());
    resolve('late');
    await done;
    expect(messagesOf(store)).toEqual([]);
    const [chat] = store.getState().chat.chats;
    expect(store.getState().chat.messagesByChat[chat!.id]).toMatchObject([
      { content: 'hi', status: 'sent' },
      { content: 'late', status: 'sent' },
    ]);
  });

  describe('AC-16: failure and retry', () => {
    it('keeps the message with status error and the user-facing text, and unblocks sending', async () => {
      const { store, sendMock } = setup();
      sendMock.mockRejectedValue(new ChatError('rate_limit'));
      await store.dispatch(sendMessage('hello'));
      expect(messagesOf(store)).toEqual([
        expect.objectContaining({
          content: 'hello',
          status: 'error',
          errorCode: 'rate_limit',
          errorMessage: 'Too many requests. Wait a moment and try again.',
        }),
      ]);
      expect(isSending(store)).toBe(false);
    });

    it('turns a non-ChatError rejection into the generic message', async () => {
      const { store, sendMock } = setup();
      sendMock.mockRejectedValue(new Error('boom'));
      await store.dispatch(sendMessage('hello'));
      expect(messagesOf(store)[0]).toMatchObject({
        status: 'error',
        errorMessage: 'Something went wrong. Try again.',
      });
    });

    it('Retry re-sends the same message with the same history, clears the error, adds the reply', async () => {
      const { store, sendMock } = setup();
      sendMock
        .mockResolvedValueOnce('first answer')
        .mockRejectedValueOnce(new ChatError('network'))
        .mockResolvedValueOnce('second answer');
      await store.dispatch(sendMessage('q1'));
      await store.dispatch(sendMessage('q2'));
      const failedId = messagesOf(store)[2]!.id;
      await store.dispatch(retryMessage({ id: failedId }));
      expect(sendMock.mock.calls[2]![0]).toEqual(sendMock.mock.calls[1]![0]);
      expect(messagesOf(store)).toMatchObject([
        { content: 'q1', status: 'sent' },
        { content: 'first answer', status: 'sent' },
        { content: 'q2', status: 'sent' },
        { content: 'second answer', status: 'sent' },
      ]);
      expect(messagesOf(store)[2]!.errorMessage).toBeUndefined();
    });

    it('a failed retry stays an error and keeps the message', async () => {
      const { store, sendMock } = setup();
      sendMock
        .mockRejectedValueOnce(new ChatError('network'))
        .mockRejectedValueOnce(new ChatError('timeout'));
      await store.dispatch(sendMessage('q1'));
      await store.dispatch(retryMessage({ id: messagesOf(store)[0]!.id }));
      expect(messagesOf(store)).toHaveLength(1);
      expect(messagesOf(store)[0]).toMatchObject({ status: 'error', errorCode: 'timeout' });
    });

    it('a failed message is not included in the history of later messages', async () => {
      const { store, sendMock } = setup();
      sendMock.mockRejectedValueOnce(new ChatError('network')).mockResolvedValueOnce('ok');
      await store.dispatch(sendMessage('failed one'));
      await store.dispatch(sendMessage('next one'));
      expect(sendMock.mock.calls[1]![0]).toEqual([{ role: 'user', content: 'next one' }]);
      expect(messagesOf(store).map((m) => m.status)).toEqual(['error', 'sent', 'sent']);
    });
  });

  it('does not start a second request while one is in flight, nor send blank text', async () => {
    const { store, sendMock } = setup();
    sendMock.mockReturnValue(new Promise(() => undefined));
    store.dispatch(sendMessage('one'));
    await store.dispatch(sendMessage('two'));
    await new Promise((r) => setTimeout(r, 0)); // let the first request reach the provider
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(messagesOf(store)).toHaveLength(1);
    const other = setup();
    await other.store.dispatch(sendMessage('   '));
    expect(other.sendMock).not.toHaveBeenCalled();
  });

  it('retry is ignored for messages that did not fail', async () => {
    const { store, sendMock } = setup();
    sendMock.mockResolvedValue('ok');
    await store.dispatch(sendMessage('hi'));
    await store.dispatch(retryMessage({ id: messagesOf(store)[0]!.id }));
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
