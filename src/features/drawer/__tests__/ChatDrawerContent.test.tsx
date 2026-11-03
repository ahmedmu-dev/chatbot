import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemoryChatRepository } from '@/db';
import {
  loadChats,
  makeStore,
  openChat,
  selectChats,
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

describe('AC-15..AC-18: long-press menu, rename and delete', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  const lastAlert = () => {
    const [title, message, buttons] = alertSpy.mock.calls.at(-1) as [
      string,
      string | undefined,
      AlertButton[],
    ];
    return { title, message, buttons };
  };
  const choose = async (label: string) => {
    const button = lastAlert().buttons.find((b) => b.text === label)!;
    await act(async () => {
      button.onPress?.();
    });
  };
  const longPress = (id: string) => fireEvent(screen.getByTestId(`drawer_chat_${id}`), 'longPress');
  const titlesOf = (s: Awaited<ReturnType<typeof setup>>) =>
    selectChats(s.store.getState()).map((c) => c.title);

  it('AC-15: long-press offers Rename, Delete and Cancel', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await longPress(a);
    expect(lastAlert().buttons.map((b) => b.text)).toEqual(['Rename', 'Delete', 'Cancel']);
    expect(lastAlert().buttons[1]?.style).toBe('destructive');
    await choose('Cancel');
    expect(titlesOf(s)).toEqual(['Chat A']);
  });

  it('AC-16: Rename opens a dialog prefilled with the title', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    expect(screen.queryByTestId('drawer_rename_dialog')).not.toBeOnTheScreen();
    await longPress(a);
    await choose('Rename');
    expect(screen.getByTestId('drawer_rename_input').props.value).toBe('Chat A');
  });

  it('AC-16: Save is disabled while the trimmed text is empty', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await longPress(a);
    await choose('Rename');
    const saveDisabled = () =>
      screen.getByTestId('drawer_rename_save_btn').props.accessibilityState.disabled;
    expect(saveDisabled()).toBe(false);
    await fireEvent.changeText(screen.getByTestId('drawer_rename_input'), '   ');
    expect(saveDisabled()).toBe(true);
    await fireEvent.press(screen.getByTestId('drawer_rename_save_btn'));
    expect(titlesOf(s)).toEqual(['Chat A']);
    await fireEvent.changeText(screen.getByTestId('drawer_rename_input'), 'x');
    expect(saveDisabled()).toBe(false);
  });

  it('AC-16: the input allows at most 60 characters', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await longPress(a);
    await choose('Rename');
    expect(screen.getByTestId('drawer_rename_input').props.maxLength).toBe(60);
  });

  it('AC-16: Save stores the trimmed title in the list, the header source and the database', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await createChat(s, 'Chat B');
    await longPress(a);
    await choose('Rename');
    await fireEvent.changeText(screen.getByTestId('drawer_rename_input'), '  Holiday plans  ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('drawer_rename_save_btn'));
    });
    expect(screen.queryByTestId('drawer_rename_dialog')).not.toBeOnTheScreen();
    expect(screen.getByTestId(`drawer_chat_${a}_title`)).toHaveTextContent('Holiday plans');
    expect(s.repo.chats.find((c) => c.id === a)?.title).toBe('Holiday plans');
    expect(titlesOf(s)).toEqual(['Chat B', 'Holiday plans']); // rename does not reorder
  });

  it('AC-16: Cancel changes nothing', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await longPress(a);
    await choose('Rename');
    await fireEvent.changeText(screen.getByTestId('drawer_rename_input'), 'Other');
    await fireEvent.press(screen.getByTestId('drawer_rename_cancel_btn'));
    expect(screen.queryByTestId('drawer_rename_dialog')).not.toBeOnTheScreen();
    expect(titlesOf(s)).toEqual(['Chat A']);
    expect(s.repo.chats[0]?.title).toBe('Chat A');
  });

  it('AC-17: Delete asks for confirmation with the exact copy; Cancel changes nothing', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    await longPress(a);
    await choose('Delete');
    const { title, message, buttons } = lastAlert();
    expect(title).toBe('Delete chat?');
    expect(message).toBe('This deletes "Chat A" and all its messages. This can\'t be undone.');
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['Cancel', 'cancel'],
      ['Delete', 'destructive'],
    ]);
    await choose('Cancel');
    expect(titlesOf(s)).toEqual(['Chat A']);
    expect(s.repo.chats).toHaveLength(1);
  });

  it('AC-18: confirming Delete removes the chat and its messages from the list and the database', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    const b = await createChat(s, 'Chat B');
    await longPress(a);
    await choose('Delete');
    await choose('Delete');
    expect(screen.queryByTestId(`drawer_chat_${a}`)).not.toBeOnTheScreen();
    expect(screen.getByTestId(`drawer_chat_${b}`)).toBeOnTheScreen();
    expect(s.repo.chats.map((c) => c.id)).toEqual([b]);
    expect(s.repo.messages.every((m) => m.chatId === b)).toBe(true);
    expect(selectActiveChat(s.store.getState())?.id).toBe(b); // the open chat was not deleted
  });

  it('AC-18: deleting the open chat opens a new empty chat and shows the empty state', async () => {
    const s = await setup();
    const a = await createChat(s, 'Chat A');
    expect(selectActiveChat(s.store.getState())?.id).toBe(a);
    await longPress(a);
    await choose('Delete');
    await choose('Delete');
    expect(selectActiveChat(s.store.getState())).toBeNull();
    expect(selectMessages(s.store.getState())).toEqual([]);
    expect(screen.getByText('No chats yet')).toBeOnTheScreen();
  });
});
