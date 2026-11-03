import * as SQLite from 'expo-sqlite';

import { isChatErrorCode, userMessageFor } from '@/providers/ChatError';

import { PRAGMAS_SQL, SCHEMA_V1_SQL, SCHEMA_VERSION } from './schema';
import type {
  Chat,
  ChatRepository,
  ChatSummary,
  MessagePatch,
  MessageRole,
  MessageStatus,
  StoredMessage,
} from './types';

export const DB_NAME = 'parley.db';

interface ChatRow {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  lastMessage: string | null;
}

interface MessageRow {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
}

function toMessage(row: MessageRow): StoredMessage {
  const message: StoredMessage = {
    id: row.id,
    chatId: row.chatId,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
  };
  if (row.errorCode !== null && isChatErrorCode(row.errorCode)) message.errorCode = row.errorCode;
  if (row.errorMessage !== null) message.errorMessage = row.errorMessage;
  return message;
}

const INSERT_CHAT =
  'INSERT INTO chats (id, title, model, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)';
const INSERT_MESSAGE =
  'INSERT INTO messages (id, chatId, role, content, status, errorCode, errorMessage, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

function messageParams(m: StoredMessage) {
  return [
    m.id,
    m.chatId,
    m.role,
    m.content,
    m.status,
    m.errorCode ?? null,
    m.errorMessage ?? null,
    m.createdAt,
  ];
}

export class SqliteChatRepository implements ChatRepository {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  constructor(private readonly name: string = DB_NAME) {}

  /** Opens and prepares the database once; every method waits for it. */
  private db(): Promise<SQLite.SQLiteDatabase> {
    this.dbPromise ??= this.open();
    return this.dbPromise;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(this.name);
    await db.execAsync(PRAGMAS_SQL);
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(SCHEMA_V1_SQL);
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      });
    }
    // AC-4: a request that was in flight when the app died can never complete.
    await db.runAsync(
      "UPDATE messages SET status = 'error', errorCode = 'unknown', errorMessage = ? WHERE status = 'pending'",
      [userMessageFor('unknown')],
    );
    return db;
  }

  async init(): Promise<void> {
    await this.db();
  }

  async listChats(): Promise<ChatSummary[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<ChatRow>(
      `SELECT c.id, c.title, c.model, c.createdAt, c.updatedAt,
        (SELECT m.content FROM messages m WHERE m.chatId = c.id
           ORDER BY m.createdAt DESC, m.rowid DESC LIMIT 1) AS lastMessage
       FROM chats c ORDER BY c.updatedAt DESC, c.rowid DESC`,
    );
    return rows;
  }

  async listMessages(chatId: string): Promise<StoredMessage[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<MessageRow>(
      'SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC, rowid ASC',
      [chatId],
    );
    return rows.map(toMessage);
  }

  async createChatWithMessage(chat: Chat, message: StoredMessage): Promise<void> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync(INSERT_CHAT, [
        chat.id,
        chat.title,
        chat.model,
        chat.createdAt,
        chat.updatedAt,
      ]);
      await db.runAsync(INSERT_MESSAGE, messageParams(message));
    });
  }

  async addMessage(message: StoredMessage): Promise<void> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      await db.runAsync(INSERT_MESSAGE, messageParams(message));
      await db.runAsync('UPDATE chats SET updatedAt = ? WHERE id = ?', [
        message.createdAt,
        message.chatId,
      ]);
    });
  }

  async updateMessage(id: string, patch: MessagePatch): Promise<void> {
    const db = await this.db();
    const sets: string[] = [];
    const params: (string | null)[] = [];
    if (patch.content !== undefined) {
      sets.push('content = ?');
      params.push(patch.content);
    }
    if (patch.status !== undefined) {
      sets.push('status = ?');
      params.push(patch.status);
    }
    if ('errorCode' in patch) {
      sets.push('errorCode = ?');
      params.push(patch.errorCode ?? null);
    }
    if ('errorMessage' in patch) {
      sets.push('errorMessage = ?');
      params.push(patch.errorMessage ?? null);
    }
    if (sets.length === 0) return;
    await db.runAsync(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  }

  async renameChat(id: string, title: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('UPDATE chats SET title = ? WHERE id = ?', [title, id]);
  }

  async deleteChat(id: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('DELETE FROM chats WHERE id = ?', [id]);
  }
}
