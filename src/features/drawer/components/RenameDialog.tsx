import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TITLE_MAX } from '@/config/chat';
import { colors, radii, spacing, typography } from '@/theme';

interface RenameDialogProps {
  initialTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}

/** One custom dialog for Android and iOS (Android has no native text prompt). */
export function RenameDialog({ initialTitle, onSave, onCancel }: RenameDialogProps) {
  const [value, setValue] = useState(initialTitle);
  const trimmed = value.trim();
  const canSave = trimmed.length > 0;

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <View style={styles.dialog} testID="rename_dialog">
          <Text style={styles.heading} accessibilityRole="header">
            Rename chat
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            maxLength={TITLE_MAX}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => canSave && onSave(trimmed)}
            accessibilityLabel="Chat name"
            style={styles.input}
            testID="rename_input"
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.action}
              testID="rename_cancel_btn"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(trimmed)}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
              style={styles.action}
              testID="rename_save_btn"
            >
              <Text style={[styles.saveText, !canSave && styles.saveDisabled]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: { backgroundColor: colors.background, borderRadius: radii.bubble, padding: spacing.l },
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.m },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.code,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.l },
  action: { paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  cancelText: { ...typography.body, color: colors.textSecondary },
  saveText: { ...typography.body, fontWeight: '600', color: colors.accent },
  saveDisabled: { color: colors.disabled },
});
