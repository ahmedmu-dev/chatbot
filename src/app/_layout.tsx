import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadChats, store } from '@/store';
import { colors } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    void store.dispatch(loadChats());
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SafeAreaProvider>
    </Provider>
  );
}
