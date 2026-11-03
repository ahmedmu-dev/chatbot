import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { FlatList } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatError, type ChatProvider } from '@/providers';
import { MemoryChatRepository } from '@/db';
import { makeStore, selectMessages } from '@/store';

import { ChatScreen, COPIED_TOAST_MS } from '../ChatScreen';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const metrics = {
  frame: { x: 0, y: 0, width: 414, height: 896 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Send = jest.MockedFunction<ChatProvider['sendMessage']>;

async function setup() {
  const sendMock: Send = jest.fn();
  const store = makeStore({ sendMessage: sendMock }, new MemoryChatRepository());
  await render(
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ChatScreen />
      </SafeAreaProvider>
    </Provider>,
  );
  return { sendMock, store };
}

async function type(text: string) {
  await fireEvent.changeText(screen.getByTestId('chat_input'), text);
}
async function tapSend() {
  await fireEvent.press(screen.getByTestId('chat_send_btn'));
}
const sendEnabled = () =>
  screen.getByTestId('chat_send_btn').props.accessibilityState.disabled === false;

function never(): Promise<string> {
  return new Promise(() => undefined);
}

describe('AC-3: empty state', () => {
  it('shows the header, the "Ask anything" placeholder and no list', async () => {
    await setup();
    expect(screen.getByText('Parley')).toBeOnTheScreen();
    expect(screen.getByText('Ask anything')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat_list')).not.toBeOnTheScreen();
  });
});

describe('AC-11: Send enable rules', () => {
  it('is disabled when empty or whitespace only, enabled with text', async () => {
    await setup();
    expect(sendEnabled()).toBe(false);
    await type('   ');
    expect(sendEnabled()).toBe(false);
    await type('hello');
    expect(sendEnabled()).toBe(true);
  });

  it('is disabled while a request is in flight, enabled again after the reply', async () => {
    const { sendMock } = await setup();
    let resolve: (t: string) => void = () => undefined;
    sendMock.mockReturnValue(new Promise((r) => (resolve = r)));
    await type('one');
    await tapSend();
    await type('two');
    expect(sendEnabled()).toBe(false);
    await act(async () => resolve('done'));
    expect(sendEnabled()).toBe(true);
  });
});

describe('AC-10 / AC-12: sending and layout', () => {
  it('AC-12: my message appears at once, the input clears and the typing indicator shows', async () => {
    const { sendMock } = await setup();
    sendMock.mockReturnValue(never());
    await type('Hello there');
    await tapSend();
    expect(screen.getByText('Hello there')).toBeOnTheScreen();
    expect(screen.getByTestId('chat_input').props.value).toBe('');
    expect(screen.getByTestId('chat_typing_indicator')).toBeOnTheScreen();
    expect(screen.queryByText('Ask anything')).not.toBeOnTheScreen();
  });

  it('AC-12: the indicator disappears when the reply arrives', async () => {
    const { sendMock } = await setup();
    sendMock.mockResolvedValue('The reply');
    await type('Q');
    await tapSend();
    await waitFor(() => expect(screen.getByText('The reply')).toBeOnTheScreen());
    expect(screen.queryByTestId('chat_typing_indicator')).not.toBeOnTheScreen();
  });

  it('AC-10: user messages are right-aligned, assistant left-aligned, oldest first', async () => {
    const { sendMock, store } = await setup();
    sendMock.mockResolvedValue('Answer');
    await type('Question');
    await tapSend();
    await waitFor(() => expect(screen.getByText('Answer')).toBeOnTheScreen());
    const [user, assistant] = selectMessages(store.getState());
    const list = screen.getByTestId('chat_list');
    const rows = within(list).getAllByTestId(/^chat_message_/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      `chat_message_${user!.id}`,
      `chat_message_${assistant!.id}`,
    ]);
    const userRow = screen.getByTestId(`chat_message_${user!.id}`);
    const assistantRow = screen.getByTestId(`chat_message_${assistant!.id}`);
    expect(userRow).toHaveStyle({ backgroundColor: '#4F46E5' });
    expect(assistantRow).toHaveStyle({ backgroundColor: '#F4F4F6' });
    const flat = (n: typeof userRow) => n.parent!.props.style;
    expect(JSON.stringify(flat(userRow))).toContain('flex-end');
    expect(JSON.stringify(flat(assistantRow))).toContain('flex-start');
  });
});

describe('AC-13: Markdown', () => {
  it('renders headings, lists, bold, inline code and a monospace code block', async () => {
    const { sendMock } = await setup();
    sendMock.mockResolvedValue(
      '# Title\n\n- item one\n- item two\n\nSome **bold** and `inline` text\n\n```js\nconst a = 1;\n```',
    );
    await type('md');
    await tapSend();
    await waitFor(() => expect(screen.getByText('Title')).toBeOnTheScreen());
    expect(screen.getByText('item one')).toBeOnTheScreen();
    expect(screen.getByText('item two')).toBeOnTheScreen();
    expect(screen.getByText('bold')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('inline')).toBeOnTheScreen();
    expect(screen.queryByText(/\*\*bold\*\*/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/```/)).not.toBeOnTheScreen();
    const block = screen.getByTestId('chat_code_block');
    expect(within(block).getByText('const a = 1;')).toHaveStyle({ fontFamily: 'Menlo' });
    expect(within(block).getByTestId('chat_code_scroll').props.horizontal).toBe(true);
  });

  it('shows user text verbatim (no Markdown)', async () => {
    const { sendMock } = await setup();
    sendMock.mockReturnValue(never());
    await type('**not bold**');
    await tapSend();
    expect(screen.getByText('**not bold**')).toBeOnTheScreen();
  });
});

describe('AC-14: auto-scroll', () => {
  it('scrolls to the newest item when the content grows', async () => {
    const spy = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    const { sendMock } = await setup();
    sendMock.mockReturnValue(never());
    await type('Hi');
    await tapSend();
    spy.mockClear();
    await fireEvent(screen.getByTestId('chat_list'), 'contentSizeChange', 300, 900);
    expect(spy).toHaveBeenCalledWith({ animated: true });
    spy.mockRestore();
  });
});

describe('AC-15: copy', () => {
  beforeEach(() => jest.mocked(Clipboard.setStringAsync).mockClear());

  it('long-press copies the message text and shows "Copied" briefly', async () => {
    const { sendMock, store } = await setup();
    sendMock.mockResolvedValue('Assistant **text**');
    await type('My question');
    await tapSend();
    await waitFor(() => expect(selectMessages(store.getState())).toHaveLength(2));
    jest.useFakeTimers();
    try {
      const [user, assistant] = selectMessages(store.getState());
      await fireEvent(screen.getByTestId(`chat_message_${user!.id}`), 'longPress');
      expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('My question');
      expect(screen.getByText('Copied')).toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(COPIED_TOAST_MS + 10));
      expect(screen.queryByText('Copied')).not.toBeOnTheScreen();

      await fireEvent(screen.getByTestId(`chat_message_${assistant!.id}`), 'longPress');
      expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('Assistant **text**');
      expect(screen.getByTestId('chat_copied_toast')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('AC-16 / AC-17: errors and retry', () => {
  it('AC-16: keeps my message, shows the error text and Retry, and Send works again', async () => {
    const { sendMock } = await setup();
    sendMock.mockRejectedValue(new ChatError('rate_limit'));
    await type('Will fail');
    await tapSend();
    await waitFor(() => expect(screen.getByTestId('chat_error_text')).toBeOnTheScreen());
    expect(screen.getByText('Will fail')).toBeOnTheScreen();
    expect(screen.getByText('Too many requests. Wait a moment and try again.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Retry')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat_typing_indicator')).not.toBeOnTheScreen();
    await type('Next');
    expect(sendEnabled()).toBe(true);
  });

  it('AC-16: Retry re-sends the same message with the same history; the error goes and the reply shows', async () => {
    const { sendMock } = await setup();
    sendMock
      .mockRejectedValueOnce(new ChatError('overloaded'))
      .mockResolvedValueOnce('Now it works');
    await type('Try me');
    await tapSend();
    await waitFor(() => expect(screen.getByTestId('chat_retry_btn')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('chat_retry_btn'));
    await waitFor(() => expect(screen.getByText('Now it works')).toBeOnTheScreen());
    expect(screen.queryByTestId('chat_error_text')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('chat_retry_btn')).not.toBeOnTheScreen();
    expect(sendMock.mock.calls[1]![0]).toEqual(sendMock.mock.calls[0]![0]);
    expect(screen.getAllByText('Try me')).toHaveLength(1);
  });

  it('AC-17: when offline the app does not crash and shows the offline message', async () => {
    const { sendMock } = await setup();
    sendMock.mockRejectedValue(new ChatError('network'));
    await type('Anyone there?');
    await tapSend();
    await waitFor(() =>
      expect(
        screen.getByText("You're offline. Check your connection and try again."),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('Anyone there?')).toBeOnTheScreen();
  });
});

describe('AC-18: keyboard', () => {
  it('keeps the input and Send inside the keyboard-avoiding container', async () => {
    await setup();
    const avoider = screen.getByTestId('chat_keyboard_avoider');
    expect(within(avoider).getByTestId('chat_input')).toBeOnTheScreen();
    expect(within(avoider).getByTestId('chat_send_btn')).toBeOnTheScreen();
  });
});

describe('AC-19 / AC-22: New chat', () => {
  it('AC-19: clears the conversation and shows the empty state', async () => {
    const { sendMock } = await setup();
    sendMock.mockResolvedValue('Reply');
    await type('First');
    await tapSend();
    await waitFor(() => expect(screen.getByText('Reply')).toBeOnTheScreen());
    await fireEvent.press(screen.getByLabelText('New chat'));
    expect(screen.queryByText('First')).not.toBeOnTheScreen();
    expect(screen.queryByText('Reply')).not.toBeOnTheScreen();
    expect(screen.getByText('Ask anything')).toBeOnTheScreen();
  });

  it('AC-22: the next request contains nothing from the previous chat', async () => {
    const { sendMock } = await setup();
    sendMock.mockResolvedValue('Reply');
    await type('old question');
    await tapSend();
    await waitFor(() => expect(screen.getByText('Reply')).toBeOnTheScreen());
    await fireEvent.press(screen.getByLabelText('New chat'));
    await type('what did I just ask?');
    await tapSend();
    expect(sendMock.mock.calls[1]![0]).toEqual([{ role: 'user', content: 'what did I just ask?' }]);
  });
});
