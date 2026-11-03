import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import { chatRepository, type ChatRepository } from '@/db';
import { chatProvider, type ChatProvider } from '@/providers';

import chatReducer, { type ThunkExtra } from './chatSlice';

export function makeStore(
  provider: ChatProvider = chatProvider,
  repository: ChatRepository = chatRepository,
) {
  const extra: ThunkExtra = { provider, repository };
  return configureStore({
    reducer: { chat: chatReducer },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: extra } }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const store = makeStore();

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export {
  deleteChat,
  loadChats,
  openChat,
  renameChat,
  retryMessage,
  sendMessage,
  startNewChat,
} from './chatSlice';
export type { Message, MessageStatus } from './chatSlice';
export { makeAutoTitle, normalizeTitle } from './title';
export {
  selectActiveChat,
  selectActiveChatId,
  selectChats,
  selectIsChatLoading,
  selectIsSending,
  selectMessages,
} from './selectors';
