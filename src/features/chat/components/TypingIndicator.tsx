import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

export function TypingIndicator() {
  return (
    <View style={styles.row}>
      <View
        style={styles.bubble}
        accessibilityRole="progressbar"
        accessibilityLabel="Assistant is typing"
        testID="chat_typing_indicator"
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.2 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', marginVertical: spacing.xs, paddingHorizontal: spacing.l },
  bubble: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radii.bubble,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m + 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary },
});
