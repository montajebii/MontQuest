import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Logic-level verification of the reward transaction (AC-07/AC-08/AC-09)
// against a scriptable fake of the SQLite layer.
const mockHolder: { db: any } = { db: null };
jest.mock('../src/db/database', () => ({
  getDB: async () => mockHolder.db,
}));

import { completeQuestAndReward } from '../src/services/rewardService';

interface Call {
  sql: string;
  params?: any[];
}

const makeDB = (state: { questStatus: string; profile: Record<string, number> }) => {
  const calls: Call[] = [];
  const emptyRows = { item: (_i: number) => null, length: 0, raw: () => [] };
  const db = {
    executeSql: async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (sql.startsWith('UPDATE quests')) {
        const affected = state.questStatus === 'active' ? 1 : 0;
        if (affected) {state.questStatus = 'completed';}
        return [{ rowsAffected: affected, rows: emptyRows }];
      }
      if (sql.startsWith('SELECT * FROM user_profile')) {
        return [{
          rowsAffected: 0,
          rows: { item: () => state.profile, length: 1, raw: () => [state.profile] },
        }];
      }
      return [{ rowsAffected: 1, rows: emptyRows }];
    },
  };
  return { db, calls };
};

describe('completeQuestAndReward', () => {
  beforeEach(() => {
    mockHolder.db = null;
  });

  it('awards +10 coins / +25 XP with level-up, in one transaction (AC-07/08/09)', async () => {
    const state = {
      questStatus: 'active',
      profile: { id: 1, coins: 5, level: 1, current_xp: 90, total_xp: 90 },
    };
    const { db, calls } = makeDB(state);
    mockHolder.db = db;

    const reward = await completeQuestAndReward(7);

    // 5 + 10 coins; 90 + 25 XP crosses the 100 threshold → level 2, remainder 15
    expect(reward).toMatchObject({ coins: 15, level: 2, current_xp: 15, total_xp: 115 });

    const sqls = calls.map((c) => c.sql);
    expect(sqls[0]).toBe('BEGIN TRANSACTION');
    expect(sqls).toContain('COMMIT');
    expect(sqls).not.toContain('ROLLBACK');

    // profile UPDATE carries [coins, level, current_xp, total_xp]
    const profileUpdate = calls.find((c) => c.sql.startsWith('UPDATE user_profile'));
    expect(profileUpdate?.params).toEqual([15, 2, 15, 115]);

    // quest marked completed for the right id
    const questUpdate = calls.find((c) => c.sql.startsWith('UPDATE quests'));
    expect(questUpdate?.params?.[1]).toBe(7);

    // history row records the exact rewards (AC-09)
    const historyInsert = calls.find((c) => c.sql.startsWith('INSERT INTO quest_history'));
    expect(historyInsert?.params?.[0]).toBe(7);
    expect(historyInsert?.params?.[2]).toBe(10);
    expect(historyInsert?.params?.[3]).toBe(25);
  });

  it('rolls back and returns null when the quest is no longer active', async () => {
    const state = {
      questStatus: 'completed',
      profile: { id: 1, coins: 0, level: 1, current_xp: 0, total_xp: 0 },
    };
    const { db, calls } = makeDB(state);
    mockHolder.db = db;

    const reward = await completeQuestAndReward(7);

    expect(reward).toBeNull();
    const sqls = calls.map((c) => c.sql);
    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
    expect(sqls.some((s) => s.startsWith('UPDATE user_profile'))).toBe(false);
    expect(sqls.some((s) => s.startsWith('INSERT INTO quest_history'))).toBe(false);
  });
});
