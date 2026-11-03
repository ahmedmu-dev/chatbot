import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { colors, spacing, typography } from '@/theme';

export function ChatScreen() {
  return (
    <View style={styles.container} testID="chat_screen">
      <AppHeader onNewChat={() => undefined} />
      <View style={styles.empty} testID="chat_empty_state">
        <Text style={styles.placeholder}>Ask anything</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  placeholder: { ...typography.body, color: colors.textSecondary },
});
