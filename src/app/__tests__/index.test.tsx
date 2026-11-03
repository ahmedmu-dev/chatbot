import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemoryChatRepository } from '@/db';
import { makeStore } from '@/store';

import Index from '../index';

const mockOpenDrawer = jest.fn();
jest.mock('expo-router', () => ({ useNavigation: () => ({ openDrawer: mockOpenDrawer }) }));
jest.mock('expo-router/drawer', () => ({}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const metrics = {
  frame: { x: 0, y: 0, width: 414, height: 896 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('chat route', () => {
  it('AC-6/AC-7: the header shows the menu, "New chat" and the New chat button; ☰ opens the drawer', async () => {
    const store = makeStore({ sendMessage: jest.fn() }, new MemoryChatRepository());
    await render(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={metrics}>
          <Index />
        </SafeAreaProvider>
      </Provider>,
    );
    expect(screen.getByText('Ask anything')).toBeOnTheScreen();
    expect(screen.getByTestId('chat_header_title')).toHaveTextContent('New chat');
    expect(screen.getByText('☰')).toBeOnTheScreen();
    expect(screen.getByTestId('chat_new_chat_btn')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Open chats'));
    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });
});
