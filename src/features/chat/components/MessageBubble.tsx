import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, sizes, spacing, typography } from '@/theme';
import type { Message } from '@/store';

import { MarkdownMessage } from './MarkdownMessage';

interface Props {
  message: Message;
  onLongPress: (message: Message) => void;
  onRetry: (message: Message) => void;
}

export function MessageBubble({ message, onLongPress, onRetry }: Props) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <Pressable
        onLongPress={() => onLongPress(message)}
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${message.content}`}
        accessibilityHint="Long press to copy"
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
        testID={`chat_message_${message.id}`}
      >
        {isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <MarkdownMessage>{message.content}</MarkdownMessage>
        )}
      </Pressable>
      {message.status === 'error' ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText} testID="chat_error_text">
            {message.errorMessage}
          </Text>
          <Pressable
            onPress={() => onRetry(message)}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            hitSlop={8}
            style={styles.retry}
            testID="chat_retry_btn"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: spacing.xs, paddingHorizontal: spacing.l },
  rowUser: { alignItems: 'flex-end' },
  rowAssistant: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: radii.bubble,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s + 2,
  },
  bubbleUser: { backgroundColor: colors.accent, maxWidth: sizes.userBubbleMaxWidth },
  bubbleAssistant: { backgroundColor: colors.surface, maxWidth: sizes.assistantBubbleMaxWidth },
  userText: { ...typography.body, color: colors.onAccent },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    maxWidth: sizes.assistantBubbleMaxWidth,
  },
  errorText: { ...typography.small, color: colors.error, flexShrink: 1 },
  retry: { marginLeft: spacing.s },
  retryText: { ...typography.small, color: colors.accent, fontWeight: '600' },
});
