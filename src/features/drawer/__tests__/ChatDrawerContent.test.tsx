import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemoryChatRepository } from '@/db';
import {
  loadChats,
  makeStore,
  openChat,
  selectActiveChat,
  selectMessages,
  sendMessage,
  startNewChat,
} from '@/store';

import { ChatDrawerContent } from '../ChatDrawerContent';
import { formatChatTime } from '../format';

jest.mock('expo-router/drawer', () => ({}));

const metrics = {
  frame: { x: 0, y: 0, width: 414, height: 896 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let clock = 1_000;
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => ++clock);
});
afterEach(() => jest.restoreAllMocks());

async function setup(repo = new MemoryChatRepository()) {
  const sendMock = jest.fn().mockResolvedValue('reply');
  const store = makeStore({ sendMessage: sendMock }, repo);
  const closeDrawer = jest.fn();
  const props = { navigation: { closeDrawer } } as unknown as DrawerContentComponentProps;
  await render(
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ChatDrawerContent {...props} />
      </SafeAreaProvider>
    </Provider>,
  );
  return { store, closeDrawer, sendMock, repo };
}

/** Creates a saved chat and leaves the new-chat screen open. */
async function createChat(s: Awaited<ReturnType<typeof setup>>, text: string, reply = 'reply') {
  s.sendMock.mockResolvedValueOnce(reply);
  await act(async () => {
    s.store.dispatch(startNewChat());
    await s.store.dispatch(sendMessage(text));
  });
  return s.store.getState().chat.chats[0]!.id;
}

describe('AC-8: empty state', () => {
  it('shows "No chats yet" with the hint and no list', async () => {
    await setup();
    expect(screen.getByText('No chats yet')).toBeOnTheScreen();
    expect(screen.getByText("Start a conversation and it'll show up here.")).toBeOnTheScreen();
    expect(screen.queryByTestId('drawer_list')).not.toBeOnTheScreen();
    expect(screen.getByText('New chat')).toBeOnTheScreen();
  });

  it('AC-1: the empty state goes away once the first message is sent', async () => {
    const s = await setup();
    await createChat(s, 'first');
    expect(screen.queryByText('No chats yet')).not.toBeOnTheScreen();
    expect(screen.getByTestId('drawer_list')).toBeOnTheScreen();
  });
});

describe('AC-7: chat rows', () => {
  it('lists chats newest first with title, plain-text preview and time', async () => {
    const s = await setup();
    const a = await createChat(s, 'First question', 'Answer with **bold** and [link](http://x.y)');
    const b = await createChat(s, 'Second question', '# Heading\n- item');
    const rows = within(screen.getByTestId('drawer_list')).getAllByTestId(/^drawer_chat_[^_]+$/);
    expect(rows.map((r) => r.props.testID)).toEqual([`drawer_chat_${b}`, `drawer_chat_${a}`]);
    expect(screen.getByTestId(`drawer_chat_${b}_title`)).toHaveTextContent('Second question');
    expect(screen.getByTestId(`drawer_chat_${b}_preview`)).toHaveTextContent('Heading item');
    expect(screen.getByTestId(`drawer_chat_${a}_preview`)).toHaveTextContent(
      'Answer with bold and link',
    );
    const updatedAt = s.store.getState().chat.chats.find((c) => c.id === b)!.updatedAt;
    expect(screen.getByTestId(`drawer_chat_${b}_time`)).toHaveTextContent(
      formatChatTime(updatedAt),
    );
  });

  it('shows the date instead of the time for a chat updated on another day', async () => {
    const repo = new MemoryChatRepository();
    const old = new Date(2026, 9, 20, 9, 15).getTime();
    await repo.createChatWithMessage(
      { id: 'old', title: 'Old chat', model: 'm', createdAt: old, updatedAt: old },
      { id: 'm1', chatId: 'old', role: 'user', content: 'hi', status: 'sent', createdAt: old },
    );
    const s = await setup(repo);
    await act(async () => {
      await s.store.dispatch(loadChats());
    });
    const time = screen.getByTestId('drawer_chat_old_time').props.children as string;
    expect(time).toContain('2026');
    expect(time).not.toContain(':');
  });

  it('a failed last message shows its own text as the preview', async () => {
    const s = await setup();
    s.sendMock.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      s.store.dispatch(startNewChat());
      await s.store.dispatch(sendMessage('This one fails'));
    });
    const id = s.store.getState().chat.chats[0]!.id;
    expect(screen.getByTestId(`drawer_chat_${id}_preview`)).toHaveTextContent('This one fails');
  });

  it('AC-11: sending in an older chat moves it to the top and updates its preview', async () => {
    const s = await setup();
    const a = await createChat(s, 'A', 'reply A');
    const b = await createChat(s, 'B', 'reply B');
    s.sendMock.mockResolvedValueOnce('fresh reply');
    await act(async () => {
      await s.store.dispatch(openChat(a));
      await s.store.dispatch(sendMessage('A again'));
    });
    const rows = within(screen.getByTestId('drawer_list')).getAllByTestId(/^drawer_chat_[^_]+$/);
    expect(rows.map((r) => r.props.testID)).toEqual([`drawer_chat_${a}`, `drawer_chat_${b}`]);
    expect(screen.getByTestId(`drawer_chat_${a}_preview`)).toHaveTextContent('fresh reply');
  });
});

describe('AC-9: open a chat', () => {
  it('tap opens the chat, closes the drawer and highlights the row', async () => {
    const s = await setup();
    const a = await createChat(s, 'A', 'reply A');
    await createChat(s, 'B', 'reply B');
    expect(selectActiveChat(s.store.getState())?.title).toBe('B');
    await fireEvent.press(screen.getByTestId(`drawer_chat_${a}`));
    expect(selectActiveChat(s.store.getState())?.id).toBe(a);
    expect(selectMessages(s.store.getState()).map((m) => m.content)).toEqual(['A', 'reply A']);
    expect(s.closeDrawer).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(`drawer_chat_${a}`).props.accessibilityState.selected).toBe(true);
  });

  it('only the open chat is highlighted; none when on the unsaved new chat', async () => {
    const s = await setup();
    const a = await createChat(s, 'A');
    const b = await createChat(s, 'B');
    expect(screen.getByTestId(`drawer_chat_${b}`).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId(`drawer_chat_${a}`).props.accessibilityState.selected).toBe(false);
    await act(async () => {
      s.store.dispatch(startNewChat());
    });
    expect(screen.getByTestId(`drawer_chat_${b}`).props.accessibilityState.selected).toBe(false);
  });
});

describe('AC-10: New chat button', () => {
  it('opens an empty chat and closes the drawer', async () => {
    const s = await setup();
    await createChat(s, 'hello');
    expect(selectActiveChat(s.store.getState())).not.toBeNull();
    await fireEvent.press(screen.getByTestId('drawer_new_chat_btn'));
    expect(selectActiveChat(s.store.getState())).toBeNull();
    expect(s.closeDrawer).toHaveBeenCalledTimes(1);
  });
});
