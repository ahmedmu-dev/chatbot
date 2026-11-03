import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatSummary } from '@/db';
import {
  deleteChat,
  openChat,
  renameChat,
  selectActiveChatId,
  selectChats,
  startNewChat,
  useAppDispatch,
  useAppSelector,
} from '@/store';
import { colors, radii, spacing, typography } from '@/theme';

import { ChatRow } from './components/ChatRow';
import { RenameDialog } from './components/RenameDialog';

/** Drawer body: the New chat button, then the saved chats, newest first. */
export function ChatDrawerContent({ navigation }: DrawerContentComponentProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const chats = useAppSelector(selectChats);
  const activeChatId = useAppSelector(selectActiveChatId);

  const handleNewChat = () => {
    dispatch(startNewChat());
    navigation.closeDrawer();
  };

  const handleOpen = useCallback(
    (id: string) => {
      void dispatch(openChat(id));
      navigation.closeDrawer();
    },
    [dispatch, navigation],
  );

  const [renaming, setRenaming] = useState<ChatSummary | null>(null);

  const confirmDelete = useCallback(
    (chat: ChatSummary) => {
      Alert.alert(
        'Delete chat?',
        `This deletes "${chat.title}" and all its messages. This can't be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void dispatch(deleteChat(chat.id)),
          },
        ],
        { cancelable: true },
      );
    },
    [dispatch],
  );

  /** AC-15: long-press menu. */
  const handleLongPress = useCallback(
    (chat: ChatSummary) => {
      Alert.alert(
        chat.title,
        undefined,
        [
          { text: 'Rename', onPress: () => setRenaming(chat) },
          { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(chat) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true },
      );
    },
    [confirmDelete],
  );

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
      {chats.length === 0 ? (
        <View style={styles.empty} testID="drawer_empty_state">
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyBody}>{"Start a conversation and it'll show up here."}</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ChatRow
              chat={item}
              active={item.id === activeChatId}
              onPress={handleOpen}
              onLongPress={handleLongPress}
            />
          )}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.l }}
          testID="drawer_list"
        />
      )}
      {renaming ? (
        <RenameDialog
          key={renaming.id}
          initialTitle={renaming.title}
          onSave={(title) => {
            void dispatch(renameChat(renaming.id, title));
            setRenaming(null);
          }}
          onCancel={() => setRenaming(null)}
        />
      ) : null}
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
  list: { flex: 1, marginTop: spacing.m },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
