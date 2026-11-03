import type { RootState } from './index';

export const selectMessages = (state: RootState) => state.chat.messages;
export const selectIsSending = (state: RootState) => state.chat.inFlightId !== null;
