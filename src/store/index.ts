import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import { chatProvider, type ChatProvider } from '@/providers';

import chatReducer, { type ThunkExtra } from './chatSlice';

export function makeStore(provider: ChatProvider = chatProvider) {
  const extra: ThunkExtra = { provider };
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

export { sendMessage, retryMessage, newChat } from './chatSlice';
export type { Message, MessageStatus } from './chatSlice';
export { selectMessages, selectIsSending } from './selectors';
