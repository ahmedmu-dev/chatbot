import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import {
  retryMessage,
  selectActiveChat,
  selectIsChatLoading,
  selectIsSending,
  selectMessages,
  sendMessage,
  startNewChat,
  useAppDispatch,
  useAppSelector,
  type Message,
} from '@/store';
import { colors, radii, spacing, typography } from '@/theme';

import { InputBar } from './components/InputBar';
import { MessageBubble } from './components/MessageBubble';
import { TypingIndicator } from './components/TypingIndicator';

export const COPIED_TOAST_MS = 1500;

const noop = () => undefined;

interface ChatScreenProps {
  /** Opens the chats drawer (☰). */
  onOpenMenu?: () => void;
}

export function ChatScreen({ onOpenMenu }: ChatScreenProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessages);
  const sending = useAppSelector(selectIsSending);
  const activeChat = useAppSelector(selectActiveChat);
  const loading = useAppSelector(selectIsChatLoading);
  const listRef = useRef<FlatList<Message>>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async (message: Message) => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
  }, []);

  const handleRetry = useCallback(
    (message: Message) => {
      dispatch(retryMessage({ id: message.id }));
    },
    [dispatch],
  );

  const scrollToEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);

  return (
    <View style={styles.container} testID="chat_screen">
      <AppHeader
        title={activeChat?.title ?? 'New chat'}
        onOpenMenu={onOpenMenu ?? noop}
        onNewChat={() => dispatch(startNewChat())}
      />
      <KeyboardAvoidingView
        // The app is edge-to-edge on Android, so the window does not resize: pad on both platforms.
        behavior="padding"
        testID="chat_keyboard_avoider"
        style={styles.flex}
      >
        {loading ? (
          <View style={styles.empty} testID="chat_loading" />
        ) : messages.length === 0 ? (
          <View style={styles.empty} testID="chat_empty_state">
            <Text style={styles.placeholder}>Ask anything</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} onLongPress={handleCopy} onRetry={handleRetry} />
            )}
            ListFooterComponent={sending ? <TypingIndicator /> : undefined}
            onContentSizeChange={scrollToEnd}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            style={styles.flex}
            testID="chat_list"
          />
        )}
        {copied ? (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toast} accessibilityLiveRegion="polite" testID="chat_copied_toast">
              <Text style={styles.toastText}>Copied</Text>
            </View>
          </View>
        ) : null}
        <InputBar sending={sending} onSend={(text) => dispatch(sendMessage(text))} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  placeholder: { ...typography.body, color: colors.textSecondary },
  listContent: { paddingVertical: spacing.m },
  toastWrap: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
  toast: {
    backgroundColor: colors.text,
    borderRadius: radii.input,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  toastText: { ...typography.small, color: colors.background },
});
