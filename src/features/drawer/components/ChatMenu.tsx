import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

interface Option {
  label: string;
  testID: string;
  onPress: () => void;
  destructive?: boolean;
}

interface DialogShellProps {
  title: string;
  message?: string;
  options?: Option[];
  /** Horizontal row of buttons (confirmation) instead of a vertical menu. */
  row?: boolean;
  onClose: () => void;
  testID: string;
}

/** Shared custom modal so every control has a stable testID on both platforms. */
function DialogShell({ title, message, options = [], row, onClose, testID }: DialogShellProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Dismiss"
          testID={`${testID}_backdrop`}
        />
        <View style={styles.dialog} testID={testID}>
          <Text style={styles.heading} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={row ? styles.row : styles.column}>
            {options.map((o) => (
              <Pressable
                key={o.testID}
                onPress={o.onPress}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                testID={o.testID}
              >
                <Text style={[styles.optionText, o.destructive && styles.destructive]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ChatMenuProps {
  title: string;
  onRename: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/** AC-15: long-press menu. */
export function ChatMenu({ title, onRename, onDelete, onCancel }: ChatMenuProps) {
  return (
    <DialogShell
      title={title}
      onClose={onCancel}
      testID="drawer_menu"
      options={[
        { label: 'Rename', testID: 'drawer_menu_rename', onPress: onRename },
        { label: 'Delete', testID: 'drawer_menu_delete', onPress: onDelete, destructive: true },
        { label: 'Cancel', testID: 'drawer_menu_cancel', onPress: onCancel },
      ]}
    />
  );
}

interface DeleteDialogProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** AC-17: delete confirmation. */
export function DeleteDialog({ title, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <DialogShell
      title="Delete chat?"
      message={`This deletes "${title}" and all its messages. This can't be undone.`}
      onClose={onCancel}
      row
      testID="delete_dialog"
      options={[
        { label: 'Cancel', testID: 'delete_cancel_btn', onPress: onCancel },
        { label: 'Delete', testID: 'delete_confirm_btn', onPress: onConfirm, destructive: true },
      ]}
    />
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
  heading: { ...typography.title, color: colors.text },
  message: { ...typography.body, color: colors.textSecondary, marginTop: spacing.s },
  column: { marginTop: spacing.m },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.l },
  option: { paddingHorizontal: spacing.l, paddingVertical: spacing.m },
  pressed: { backgroundColor: colors.surface },
  optionText: { ...typography.body, color: colors.text },
  destructive: { color: colors.error },
});
