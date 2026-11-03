import {
  createAsyncThunk,
  createSlice,
  isAnyOf,
  nanoid,
  type PayloadAction,
} from '@reduxjs/toolkit';

import { SYSTEM_PROMPT } from '@/config/chat';
import {
  toChatError,
  type ChatErrorCode,
  type ChatProvider,
  type ProviderMessage,
} from '@/providers';

export type MessageStatus = 'pending' | 'sent' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  /** Set when status is 'error'. */
  errorCode?: ChatErrorCode;
  /** User-facing text for the error (AC-9). */
  errorMessage?: string;
}

export interface ChatState {
  messages: Message[];
  /** Id of the user message whose request is in flight, or null. */
  inFlightId: string | null;
}

export const initialState: ChatState = { messages: [], inFlightId: null };

export interface ThunkExtra {
  provider: ChatProvider;
}

interface ThunkConfig {
  state: { chat: ChatState };
  extra: ThunkExtra;
  rejectValue: { code: ChatErrorCode; message: string };
}

interface RequestArg {
  id: string;
  /** Present for a new message, absent for a retry. */
  text?: string;
}

interface Fulfilled {
  id: string;
  replyId: string;
  reply: string;
}

/**
 * History for a request (AC-20): every `sent` message before the target, oldest first, then the
 * target message. Pending or failed messages are never included twice.
 */
export function buildHistory(
  messages: Message[],
  targetId: string,
  text: string,
): ProviderMessage[] {
  const index = messages.findIndex((m) => m.id === targetId);
  const before = (index === -1 ? messages : messages.slice(0, index)).filter(
    (m) => m.status === 'sent',
  );
  return [...before, { role: 'user' as const, content: text }].map(({ role, content }) => ({
    role,
    content,
  }));
}

async function run(
  { id, text }: RequestArg,
  api: {
    getState: () => { chat: ChatState };
    extra: ThunkExtra;
    signal: AbortSignal;
    rejectWithValue: (v: ThunkConfig['rejectValue']) => unknown;
  },
): Promise<Fulfilled> {
  const messages = api.getState().chat.messages;
  const content = text ?? messages.find((m) => m.id === id)?.content ?? '';
  try {
    const reply = await api.extra.provider.sendMessage(buildHistory(messages, id, content), {
      system: SYSTEM_PROMPT,
      signal: api.signal,
    });
    return { id, replyId: nanoid(), reply };
  } catch (err) {
    const chatError = toChatError(err);
    throw api.rejectWithValue({ code: chatError.code, message: chatError.message });
  }
}

/** Sends a new user message; its id is the thunk's requestId. Arg is the message text. */
export const sendMessage = createAsyncThunk<Fulfilled, string, ThunkConfig>(
  'chat/sendMessage',
  (text, api) => run({ id: api.requestId, text }, api),
  {
    condition: (text, { getState }) =>
      getState().chat.inFlightId === null && text.trim().length > 0,
  },
);

export const retryMessage = createAsyncThunk<Fulfilled, { id: string }, ThunkConfig>(
  'chat/retryMessage',
  ({ id }, api) => run({ id }, api),
  {
    condition: ({ id }, { getState }) => {
      const { messages, inFlightId } = getState().chat;
      return inFlightId === null && messages.some((m) => m.id === id && m.status === 'error');
    },
  },
);

function isRetry(arg: string | { id: string }): arg is { id: string } {
  return typeof arg !== 'string';
}

function toFailure(): ThunkConfig['rejectValue'] {
  const error = toChatError(undefined);
  return { code: error.code, message: error.message };
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /** AC-19: discard the conversation. Late replies for it are ignored (their ids are gone). */
    newChat: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state, action) => {
        const id = action.meta.requestId;
        state.messages.push({ id, role: 'user', content: action.meta.arg, status: 'pending' });
        state.inFlightId = id;
      })
      .addCase(retryMessage.pending, (state, action) => {
        const message = state.messages.find((m) => m.id === action.meta.arg.id);
        if (!message) return;
        message.status = 'pending';
        delete message.errorCode;
        delete message.errorMessage;
        state.inFlightId = message.id;
      })
      .addMatcher(isAnyOf(sendMessage.rejected, retryMessage.rejected), (state, action) => {
        const id = isRetry(action.meta.arg) ? action.meta.arg.id : action.meta.requestId;
        const message = state.messages.find((m) => m.id === id);
        if (!message) return; // chat was reset while the request was in flight
        const error = action.payload ?? toFailure();
        message.status = 'error'; // AC-16: the message is never lost
        message.errorCode = error.code;
        message.errorMessage = error.message;
        if (state.inFlightId === id) state.inFlightId = null;
      })
      .addMatcher(
        isAnyOf(sendMessage.fulfilled, retryMessage.fulfilled),
        (state, action: PayloadAction<Fulfilled>) => {
          const { id, replyId, reply } = action.payload;
          const index = state.messages.findIndex((m) => m.id === id);
          if (index === -1) return; // chat was reset while the request was in flight
          state.messages[index]!.status = 'sent';
          state.messages.splice(index + 1, 0, {
            id: replyId,
            role: 'assistant',
            content: reply,
            status: 'sent',
          });
          if (state.inFlightId === id) state.inFlightId = null;
        },
      );
  },
});

export const { newChat } = chatSlice.actions;
export default chatSlice.reducer;
