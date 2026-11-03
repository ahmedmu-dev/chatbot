import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ChatDrawerContent } from '../../features/drawer/ChatDrawerContent';
import RootLayout from '../_layout';

const mockDrawer = jest.fn();
jest.mock('expo-router/drawer', () => {
  function Drawer(props: unknown) {
    mockDrawer(props);
    return null;
  }
  Drawer.Screen = function Screen() {
    return null;
  };
  return { Drawer };
});
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../features/drawer/ChatDrawerContent', () => ({
  ChatDrawerContent: function ChatDrawerContent() {
    return null;
  },
}));
jest.mock('@/store', () => ({
  store: { dispatch: jest.fn(), getState: jest.fn(), subscribe: jest.fn() },
  loadChats: jest.fn(() => ({ type: 'load' })),
}));
jest.mock('react-redux', () => ({
  Provider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const mockWidth = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth(), height: 800, scale: 1, fontScale: 1 }),
}));

function drawerProps() {
  return mockDrawer.mock.calls.at(-1)![0] as {
    screenOptions: {
      headerShown: boolean;
      drawerType: string;
      swipeEnabled: boolean;
      drawerStyle: { width: number };
    };
    drawerContent: unknown;
  };
}

describe('RootLayout drawer config', () => {
  beforeEach(() => mockDrawer.mockClear());

  it('AC-6/AC-12: a front drawer with edge swipe, no native header, custom content', async () => {
    mockWidth.mockReturnValue(400);
    await render(<RootLayout />);
    const { screenOptions, drawerContent } = drawerProps();
    expect(screenOptions).toMatchObject({
      headerShown: false,
      drawerType: 'front',
      swipeEnabled: true,
    });
    const element = (drawerContent as (p: object) => { type: unknown })({});
    expect(element.type).toBe(ChatDrawerContent);
  });

  it('AC-7: drawer width is 85% of the window on phones', async () => {
    mockWidth.mockReturnValue(360);
    await render(<RootLayout />);
    expect(drawerProps().screenOptions.drawerStyle.width).toBeCloseTo(306);
  });

  it('AC-7: drawer width is capped at 320', async () => {
    mockWidth.mockReturnValue(600);
    await render(<RootLayout />);
    expect(drawerProps().screenOptions.drawerStyle.width).toBe(320);
  });
});
