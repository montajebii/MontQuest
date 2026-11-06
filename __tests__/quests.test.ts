import { describe, it, expect, jest } from '@jest/globals';

// Logic-level verification of the quest DB functions against a scriptable
// fake of the SQLite layer (same pattern as rewardService.test.ts).
const mockHolder: { db: any } = { db: null };
jest.mock('../src/db/database', () => ({
  getDB: async () => mockHolder.db,
}));

import { addQuest, updateQuest } from '../src/db/quests';

interface Call {
  sql: string;
  params?: any[];
}

const makeDB = () => {
  const calls: Call[] = [];
  const emptyRows = { item: (_i: number) => null, length: 0, raw: () => [] };
  mockHolder.db = {
    executeSql: async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      return [{ rowsAffected: 1, rows: emptyRows }];
    },
  };
  return calls;
};

describe('quests db', () => {
  it('updateQuest writes title/task/coords/radius for the right id', async () => {
    const calls = makeDB();

    await updateQuest(7, {
      title: 'عنوان جدید',
      task: 'شرح جدید',
      latitude: 35.7,
      longitude: 51.4,
      radius: 250,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('UPDATE quests');
    expect(calls[0].sql).toContain('title = ?');
    expect(calls[0].sql).toContain('radius = ?');
    expect(calls[0].params).toEqual(['عنوان جدید', 'شرح جدید', 35.7, 51.4, 250, 7]);
  });

  it('addQuest still inserts a new active quest (create mode intact)', async () => {
    const calls = makeDB();

    await addQuest({
      title: 'کوئست تازه',
      task: 'کاری بکن',
      latitude: 35.68,
      longitude: 51.38,
      radius: 100,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('INSERT INTO quests');
    expect(calls[0].sql).toContain("'active'");
    expect(calls[0].params).toEqual([
      'کوئست تازه',
      'کاری بکن',
      35.68,
      51.38,
      100,
      expect.any(Number),
    ]);
  });
});
