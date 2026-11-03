import {
  createSlice,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';

import { DEFAULT_MODEL, SYSTEM_PROMPT } from '@/config/chat';
import {
  newId,
  type Chat,
  type ChatRepository,
  type ChatSummary,
  type MessagePatch,
  type StoredMessage,
} from '@/db';
import {
  toChatError,
  type ChatErrorCode,
  type ChatProvider,
  type ProviderMessage,
} from '@/providers';

import { makeAutoTitle, normalizeTitle } from './title';

export type { MessageStatus } from '@/db';
export type Message = StoredMessage;

export interface ChatState {
  /** Saved chats, newest `updatedAt` first. The unsaved new chat is never in here (AC-1). */
  chats: ChatSummary[];
  /** The open saved chat, or null for the unsaved new chat. */
  activeChatId: string | null;
  /** Messages of every chat opened (or written) this session. */
  messagesByChat: Record<string, Message[]>;
  /** chatId -> id of the user message whose request is in flight (AC-20). */
  inFlight: Record<string, string>;
  /** Chat whose messages are being read from the database. */
  loadingChatId: string | null;
  /** True once the chat list has been read from the database. */
  hydrated: boolean;
}

export const initialState: ChatState = {
  chats: [],
  activeChatId: null,
  messagesByChat: {},
  inFlight: {},
  loadingChatId: null,
  hydrated: false,
};

export interface ThunkExtra {
  provider: ChatProvider;
  repository: ChatRepository;
}

export type AppThunk<R = void> = ThunkAction<R, { chat: ChatState }, ThunkExtra, UnknownAction>;

/**
 * History for a request (AC-19): every `sent` message of that chat before the target, oldest
 * first, then the target message. Pending or failed messages are never included twice.
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

function moveToTop(state: ChatState, chat: ChatSummary) {
  state.chats = [chat, ...state.chats.filter((c) => c.id !== chat.id)];
}

function clearInFlight(state: ChatState, chatId: string, messageId: string) {
  if (state.inFlight[chatId] === messageId) delete state.inFlight[chatId];
}

interface FailurePayload {
  chatId: string;
  id: string;
  code: ChatErrorCode;
  message: string;
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    chatsLoaded(state, action: PayloadAction<ChatSummary[]>) {
      state.chats = action.payload;
      state.hydrated = true;
    },
    /** AC-10: opens the unsaved new chat. The previous one stays as it is. */
    newChat(state) {
      state.activeChatId = null;
      state.loadingChatId = null;
    },
    chatOpened(state, action: PayloadAction<string>) {
      state.activeChatId = action.payload;
      state.loadingChatId = state.messagesByChat[action.payload] ? null : action.payload;
    },
    messagesLoaded(state, action: PayloadAction<{ chatId: string; messages: Message[] }>) {
      const { chatId, messages } = action.payload;
      if (!state.chats.some((c) => c.id === chatId)) return; // deleted meanwhile
      state.messagesByChat[chatId] ??= messages;
      if (state.loadingChatId === chatId) state.loadingChatId = null;
    },
    /** A user message was sent. `chat` is present for the first message of a new chat (AC-1). */
    messageSent(state, action: PayloadAction<{ chat?: Chat; message: Message }>) {
      const { chat, message } = action.payload;
      if (chat) {
        moveToTop(state, { ...chat, lastMessage: message.content });
        state.messagesByChat[chat.id] = [message];
        state.activeChatId = chat.id;
      } else {
        const existing = state.chats.find((c) => c.id === message.chatId);
        if (!existing) return;
        (state.messagesByChat[message.chatId] ??= []).push(message);
        moveToTop(state, {
          ...existing,
          updatedAt: message.createdAt,
          lastMessage: message.content,
        });
      }
      state.inFlight[message.chatId] = message.id;
    },
    messageRetrying(state, action: PayloadAction<{ chatId: string; id: string }>) {
      const { chatId, id } = action.payload;
      const message = state.messagesByChat[chatId]?.find((m) => m.id === id);
      if (!message) return;
      message.status = 'pending';
      delete message.errorCode;
      delete message.errorMessage;
      state.inFlight[chatId] = id;
    },
    /** The reply lands in the chat it belongs to, whichever chat is open (AC-20). */
    replyReceived(state, action: PayloadAction<{ id: string; reply: Message }>) {
      const { id, reply } = action.payload;
      const messages = state.messagesByChat[reply.chatId];
      const chat = state.chats.find((c) => c.id === reply.chatId);
      const index = messages?.findIndex((m) => m.id === id) ?? -1;
      if (!messages || !chat || index === -1) return; // chat was deleted while in flight
      messages[index]!.status = 'sent';
      messages.splice(index + 1, 0, reply);
      clearInFlight(state, reply.chatId, id);
      // updatedAt is the time of the latest message; an old retry never moves it back.
      const updatedAt = Math.max(chat.updatedAt, reply.createdAt);
      moveToTop(state, { ...chat, updatedAt, lastMessage: reply.content });
    },
    messageFailed(state, action: PayloadAction<FailurePayload>) {
      const { chatId, id, code, message: text } = action.payload;
      const message = state.messagesByChat[chatId]?.find((m) => m.id === id);
      if (!message) return; // chat was deleted while in flight
      message.status = 'error'; // never lost (FR7)
      message.errorCode = code;
      message.errorMessage = text;
      clearInFlight(state, chatId, id);
    },
    chatRenamed(state, action: PayloadAction<{ id: string; title: string }>) {
      const chat = state.chats.find((c) => c.id === action.payload.id);
      if (chat) chat.title = action.payload.title; // order is unchanged
    },
    chatDeleted(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.chats = state.chats.filter((c) => c.id !== id);
      delete state.messagesByChat[id];
      delete state.inFlight[id];
      if (state.activeChatId === id) state.activeChatId = null;
      if (state.loadingChatId === id) state.loadingChatId = null;
    },
  },
});

export const { newChat } = chatSlice.actions;
const actions = chatSlice.actions;
export default chatSlice.reducer;

/** Write-through: the screen state is already updated, so a failed write is only logged. */
async function persist(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (err) {
    console.warn('Could not save to the database', err);
  }
}

/** Reads the chat list once at launch. The database itself is prepared on first use. */
export function loadChats(): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { repository }) => {
    try {
      await repository.init();
      dispatch(actions.chatsLoaded(await repository.listChats()));
    } catch (err) {
      console.warn('Could not load chats', err);
      dispatch(actions.chatsLoaded([]));
    }
  };
}

/** AC-9: opens a saved chat; its messages are read from the database the first time. */
export function openChat(id: string): AppThunk<Promise<void>> {
  return async (dispatch, getState, { repository }) => {
    const state = getState().chat;
    if (state.activeChatId === id || !state.chats.some((c) => c.id === id)) return;
    dispatch(actions.chatOpened(id));
    if (getState().chat.messagesByChat[id]) return;
    try {
      dispatch(actions.messagesLoaded({ chatId: id, messages: await repository.listMessages(id) }));
    } catch (err) {
      console.warn('Could not load messages', err);
      dispatch(actions.messagesLoaded({ chatId: id, messages: [] }));
    }
  };
}

/** AC-10: opens an empty new chat. Nothing happens if one is already open. */
export function startNewChat(): AppThunk {
  return (dispatch, getState) => {
    if (getState().chat.activeChatId === null) return;
    dispatch(actions.newChat());
  };
}

interface RequestTarget {
  chatId: string;
  /** The user message being answered. */
  id: string;
  text: string;
}

async function request(
  { chatId, id, text }: RequestTarget,
  dispatch: (a: UnknownAction) => unknown,
  getState: () => { chat: ChatState },
  { provider, repository }: ThunkExtra,
): Promise<void> {
  const history = buildHistory(getState().chat.messagesByChat[chatId] ?? [], id, text);
  const stillExists = () => getState().chat.chats.some((c) => c.id === chatId);
  try {
    const reply = await provider.sendMessage(history, {
      system: SYSTEM_PROMPT,
      signal: new AbortController().signal,
    });
    const message: Message = {
      id: newId(),
      chatId,
      role: 'assistant',
      content: reply,
      status: 'sent',
      createdAt: Date.now(),
    };
    dispatch(actions.replyReceived({ id, reply: message }));
    if (stillExists()) {
      await persist(async () => {
        await repository.updateMessage(id, {
          status: 'sent',
          errorCode: undefined,
          errorMessage: undefined,
        });
        await repository.addMessage(message);
      });
    }
  } catch (err) {
    const chatError = toChatError(err);
    dispatch(
      actions.messageFailed({
        chatId,
        id,
        code: chatError.code,
        message: chatError.message,
      }),
    );
    if (stillExists()) {
      const patch: MessagePatch = {
        status: 'error',
        errorCode: chatError.code,
        errorMessage: chatError.message,
      };
      await persist(() => repository.updateMessage(id, patch));
    }
  }
}

/** Sends a message in the open chat; the first message of a new chat creates and saves it. */
export function sendMessage(text: string): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const { activeChatId, inFlight } = getState().chat;
    if (text.trim().length === 0) return;
    if (activeChatId !== null && inFlight[activeChatId] !== undefined) return;

    const now = Date.now();
    const chatId = activeChatId ?? newId();
    const message: Message = {
      id: newId(),
      chatId,
      role: 'user',
      content: text,
      status: 'pending',
      createdAt: now,
    };
    const chat: Chat | undefined =
      activeChatId === null
        ? {
            id: chatId,
            title: makeAutoTitle(text),
            model: DEFAULT_MODEL,
            createdAt: now,
            updatedAt: now,
          }
        : undefined;

    dispatch(actions.messageSent({ chat, message }));
    await persist(() =>
      chat
        ? extra.repository.createChatWithMessage(chat, message)
        : extra.repository.addMessage(message),
    );
    await request({ chatId, id: message.id, text }, dispatch, getState, extra);
  };
}

/** Retries a failed message of the open chat. */
export function retryMessage({ id }: { id: string }): AppThunk<Promise<void>> {
  return async (dispatch, getState, extra) => {
    const { activeChatId, inFlight, messagesByChat } = getState().chat;
    if (activeChatId === null || inFlight[activeChatId] !== undefined) return;
    const message = messagesByChat[activeChatId]?.find((m) => m.id === id);
    if (!message || message.status !== 'error') return;

    dispatch(actions.messageRetrying({ chatId: activeChatId, id }));
    await persist(() =>
      extra.repository.updateMessage(id, {
        status: 'pending',
        errorCode: undefined,
        errorMessage: undefined,
      }),
    );
    await request({ chatId: activeChatId, id, text: message.content }, dispatch, getState, extra);
  };
}

/** AC-16: a rename always wins; the auto title is only set at creation. */
export function renameChat(id: string, input: string): AppThunk<Promise<void>> {
  return async (dispatch, getState, { repository }) => {
    const title = normalizeTitle(input);
    if (title === null || !getState().chat.chats.some((c) => c.id === id)) return;
    dispatch(actions.chatRenamed({ id, title }));
    await persist(() => repository.renameChat(id, title));
  };
}

/** AC-18: removes the chat and its messages; deleting the open chat opens a new one. */
export function deleteChat(id: string): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { repository }) => {
    dispatch(actions.chatDeleted(id));
    await persist(() => repository.deleteChat(id));
  };
}
