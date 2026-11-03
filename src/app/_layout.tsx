import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { ChatDrawerContent } from '@/features/drawer/ChatDrawerContent';
import { loadChats, store } from '@/store';
import { colors } from '@/theme';

const DRAWER_WIDTH_RATIO = 0.85;
const DRAWER_MAX_WIDTH = 320;

export default function RootLayout() {
  const { width } = useWindowDimensions();

  useEffect(() => {
    void store.dispatch(loadChats());
  }, []);

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Drawer
            drawerContent={(props) => <ChatDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
              drawerType: 'front',
              swipeEnabled: true,
              drawerStyle: {
                width: Math.min(width * DRAWER_WIDTH_RATIO, DRAWER_MAX_WIDTH),
                backgroundColor: colors.background,
              },
              sceneStyle: { backgroundColor: colors.background },
            }}
          >
            <Drawer.Screen name="index" />
          </Drawer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}
