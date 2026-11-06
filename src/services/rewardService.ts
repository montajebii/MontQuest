import { getDB } from '../db/database';
import { applyXP } from '../utils/leveling';
import { XP_PER_QUEST, COINS_PER_QUEST } from '../utils/constants';

export const completeQuestAndReward = async (questId: number) => {
  const db = await getDB();
  const now = Date.now();

  await db.executeSql('BEGIN TRANSACTION');
  try {
    const [upd] = await db.executeSql(
      "UPDATE quests SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'active'",
      [now, questId],
    );
    if (upd.rowsAffected === 0) {
      await db.executeSql('ROLLBACK');
      return null;
    }

    const [profileRes] = await db.executeSql('SELECT * FROM user_profile WHERE id = 1');
    const profile = profileRes.rows.item(0);
    const newState = applyXP(
      {
        level: profile.level,
        current_xp: profile.current_xp,
        total_xp: profile.total_xp,
        coins: profile.coins,
      },
      XP_PER_QUEST,
    );
    newState.coins += COINS_PER_QUEST;

    await db.executeSql(
      'UPDATE user_profile SET coins = ?, level = ?, current_xp = ?, total_xp = ? WHERE id = 1',
      [newState.coins, newState.level, newState.current_xp, newState.total_xp],
    );

    await db.executeSql(
      'INSERT INTO quest_history (quest_id, completed_at, coins_awarded, xp_awarded) VALUES (?, ?, ?, ?)',
      [questId, now, COINS_PER_QUEST, XP_PER_QUEST],
    );

    await db.executeSql('COMMIT');
    return newState;
  } catch (e) {
    await db.executeSql('ROLLBACK');
    throw e;
  }
};
