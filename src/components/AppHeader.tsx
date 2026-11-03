import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing, typography } from '@/theme';

interface AppHeaderProps {
  onNewChat: () => void;
}

export function AppHeader({ onNewChat }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="chat_header">
      <Text style={styles.title} accessibilityRole="header" testID="chat_title">
        Parley
      </Text>
      <Pressable
        onPress={onNewChat}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        testID="chat_new_chat_btn"
      >
        <Text style={styles.icon}>✎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    minHeight: sizes.headerHeight,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.text },
  iconButton: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.surface },
  icon: { fontSize: 22, color: colors.accent },
});
