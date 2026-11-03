import * as SQLite from 'expo-sqlite';

import { SCHEMA_V1_SQL } from '../schema';
import { SqliteChatRepository } from '../sqliteRepository';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

function makeDb(userVersion: number) {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: userVersion }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
  };
}

function setup(userVersion: number) {
  const db = makeDb(userVersion);
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(db);
  return { db, repo: new SqliteChatRepository('test.db') };
}

describe('SqliteChatRepository', () => {
  it('AC-5: schema has both tables, cascade FK, indexes, foreign_keys ON and user_version 1', async () => {
    const { db, repo } = setup(0);
    await repo.init();
    const sql = db.execAsync.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toContain('foreign_keys = ON');
    expect(sql).toContain('user_version = 1');
    expect(SCHEMA_V1_SQL).toMatch(/CREATE TABLE IF NOT EXISTS chats/);
    expect(SCHEMA_V1_SQL).toMatch(/CREATE TABLE IF NOT EXISTS messages/);
    expect(SCHEMA_V1_SQL).toMatch(/chatId TEXT NOT NULL REFERENCES chats\(id\) ON DELETE CASCADE/);
    expect(SCHEMA_V1_SQL).toMatch(/INDEX[^;]+ON messages\(chatId, createdAt\)/);
    expect(SCHEMA_V1_SQL).toMatch(/INDEX[^;]+ON chats\(updatedAt\)/);
    for (const col of ['title', 'model', 'createdAt', 'updatedAt', 'role', 'content', 'status']) {
      expect(SCHEMA_V1_SQL).toContain(col);
    }
  });

  it('AC-5: does not recreate the schema when user_version is already 1', async () => {
    const { db, repo } = setup(1);
    await repo.init();
    const sql = db.execAsync.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).not.toContain('CREATE TABLE');
  });

  it('AC-4: init marks pending messages as error', async () => {
    const { db, repo } = setup(1);
    await repo.init();
    const [sql] = db.runAsync.mock.calls[0] as [string, string[]];
    expect(sql).toMatch(/UPDATE messages SET status = 'error'.*WHERE status = 'pending'/);
  });

  it('AC-1: creates the chat and first message in one transaction', async () => {
    const { db, repo } = setup(1);
    await repo.init();
    db.runAsync.mockClear();
    db.withTransactionAsync.mockClear();
    await repo.createChatWithMessage(
      { id: 'c', title: 't', model: 'm', createdAt: 1, updatedAt: 1 },
      { id: 'x', chatId: 'c', role: 'user', content: 'hi', status: 'pending', createdAt: 1 },
    );
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining('INSERT INTO chats'),
      expect.stringContaining('INSERT INTO messages'),
    ]);
  });

  it('AC-3: updateMessage writes only the given columns, clearing errors with null', async () => {
    const { db, repo } = setup(1);
    await repo.init();
    db.runAsync.mockClear();
    await repo.updateMessage('x', {
      status: 'pending',
      errorCode: undefined,
      errorMessage: undefined,
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE messages SET status = ?, errorCode = ?, errorMessage = ? WHERE id = ?',
      ['pending', null, null, 'x'],
    );
  });

  it('AC-18: deleteChat deletes only the chat row (messages cascade)', async () => {
    const { db, repo } = setup(1);
    await repo.init();
    db.runAsync.mockClear();
    await repo.deleteChat('c');
    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM chats WHERE id = ?', ['c']);
  });
});
