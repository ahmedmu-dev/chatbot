import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemoryChatRepository } from '@/db';
import { makeStore, selectActiveChat, sendMessage } from '@/store';

import { ChatDrawerContent } from '../ChatDrawerContent';

jest.mock('expo-router/drawer', () => ({}));

const metrics = {
  frame: { x: 0, y: 0, width: 414, height: 896 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function setup() {
  const sendMock = jest.fn().mockResolvedValue('reply');
  const store = makeStore({ sendMessage: sendMock }, new MemoryChatRepository());
  const closeDrawer = jest.fn();
  const props = { navigation: { closeDrawer } };
  await render(
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={metrics}>
        <ChatDrawerContent {...(props as unknown as DrawerContentComponentProps)} />
      </SafeAreaProvider>
    </Provider>,
  );
  return { store, closeDrawer };
}

describe('ChatDrawerContent', () => {
  it('AC-10: New chat opens an empty chat and closes the drawer', async () => {
    const { store, closeDrawer } = await setup();
    await store.dispatch(sendMessage('hello'));
    expect(selectActiveChat(store.getState())).not.toBeNull();
    await fireEvent.press(screen.getByTestId('drawer_new_chat_btn'));
    expect(selectActiveChat(store.getState())).toBeNull();
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });
});
