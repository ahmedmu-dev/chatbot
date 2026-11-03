import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { startNewChat, useAppDispatch } from '@/store';
import { colors, radii, spacing, typography } from '@/theme';

/** Drawer body: the New chat button, then (DEV-4) the list of saved chats. */
export function ChatDrawerContent({ navigation }: DrawerContentComponentProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  const handleNewChat = () => {
    dispatch(startNewChat());
    navigation.closeDrawer();
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.m }]}
      testID="drawer_content"
    >
      <Pressable
        onPress={handleNewChat}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}
        testID="drawer_new_chat_btn"
      >
        <Text style={styles.newChatText}>New chat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  newChat: {
    marginHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radii.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  newChatText: { ...typography.body, fontWeight: '600', color: colors.onAccent },
});
