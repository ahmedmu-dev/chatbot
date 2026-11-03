import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing, typography } from '@/theme';

interface Props {
  /** True while a request is in flight (AC-11). */
  sending: boolean;
  onSend: (text: string) => void;
}

export function InputBar({ sending, onSend }: Props) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const canSend = text.trim().length > 0 && !sending;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View
      style={[styles.bar, { paddingBottom: spacing.s + insets.bottom }]}
      testID="chat_input_bar"
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message Parley"
        placeholderTextColor={colors.textSecondary}
        multiline
        style={styles.input}
        accessibilityLabel="Message input"
        testID="chat_input"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !canSend }}
        style={[styles.send, canSend ? styles.sendEnabled : styles.sendDisabled]}
        testID="chat_send_btn"
      >
        <Text style={styles.sendIcon}>↑</Text>
      </Pressable>
    </View>
  );
}

const LINE_HEIGHT = typography.body.lineHeight;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    backgroundColor: colors.background,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: sizes.sendButton,
    maxHeight: LINE_HEIGHT * 5 + spacing.m * 2, // grows up to 5 lines
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    color: colors.text,
  },
  send: {
    width: sizes.sendButton,
    height: sizes.sendButton,
    borderRadius: sizes.sendButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendEnabled: { backgroundColor: colors.accent },
  sendDisabled: { backgroundColor: colors.disabled },
  sendIcon: { color: colors.onAccent, fontSize: 20, fontWeight: '700' },
});
