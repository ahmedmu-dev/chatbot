import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatSummary } from '@/db';
import { colors, radii, spacing, typography } from '@/theme';

import { formatChatTime, stripMarkdown } from '../format';

interface ChatRowProps {
  chat: ChatSummary;
  active: boolean;
  onPress: (id: string) => void;
  onLongPress: (chat: ChatSummary) => void;
}

export const ChatRow = memo(function ChatRow({ chat, active, onPress, onLongPress }: ChatRowProps) {
  const preview = chat.lastMessage === null ? '' : stripMarkdown(chat.lastMessage);
  return (
    <Pressable
      onPress={() => onPress(chat.id)}
      onLongPress={() => onLongPress(chat)}
      accessibilityRole="button"
      accessibilityLabel={chat.title}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.row, (active || pressed) && styles.highlight]}
      testID={`drawer_chat_${chat.id}`}
    >
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1} testID={`drawer_chat_title_${chat.id}`}>
          {chat.title}
        </Text>
        <Text style={styles.preview} numberOfLines={1} testID={`drawer_chat_preview_${chat.id}`}>
          {preview}
        </Text>
      </View>
      <Text style={styles.time} testID={`drawer_chat_time_${chat.id}`}>
        {formatChatTime(chat.updatedAt)}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    marginHorizontal: spacing.s,
    borderRadius: radii.button,
  },
  highlight: { backgroundColor: colors.surface },
  texts: { flex: 1, marginRight: spacing.s },
  title: { ...typography.body, fontWeight: '700', color: colors.text },
  preview: { ...typography.small, color: colors.textSecondary },
  time: { ...typography.small, color: colors.textSecondary },
});
