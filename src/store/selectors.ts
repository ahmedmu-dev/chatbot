import type { Message } from './chatSlice';
import type { RootState } from './index';

const NO_MESSAGES: Message[] = [];

export const selectChats = (state: RootState) => state.chat.chats;
export const selectActiveChatId = (state: RootState) => state.chat.activeChatId;
export const selectActiveChat = (state: RootState) =>
  state.chat.chats.find((c) => c.id === state.chat.activeChatId) ?? null;
export const selectMessages = (state: RootState): Message[] =>
  (state.chat.activeChatId !== null && state.chat.messagesByChat[state.chat.activeChatId]) ||
  NO_MESSAGES;
export const selectIsSending = (state: RootState) =>
  state.chat.activeChatId !== null && state.chat.inFlight[state.chat.activeChatId] !== undefined;
export const selectIsChatLoading = (state: RootState) => state.chat.loadingChatId !== null;
