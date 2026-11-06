import { getDB } from './database';
import { Quest, QuestHistoryEntry } from '../types';

/**
 * Device-QA hardening: every DB call is guarded (a legacy row or SQLite
 * hiccup must never crash the UI — ErrorBoundary is the last resort) and
 * every quest row is sanitized into strict numbers before it reaches
 * React (quests created by older builds may have odd column values).
 */

const sanitizeQuest = (row: Record<string, unknown>): Quest => ({
  id: Number(row?.id ?? 0),
  title: String(row?.title ?? ''),
  task: String(row?.task ?? ''),
  latitude: Number(row?.latitude ?? 0),
  longitude: Number(row?.longitude ?? 0),
  radius: Number(row?.radius ?? 100),
  status: row?.status === 'completed' ? 'completed' : 'active',
  created_at: Number(row?.created_at ?? 0),
  completed_at:
    row?.completed_at == null ? undefined : Number(row.completed_at),
});

export const addQuest = async (
  quest: Omit<Quest, 'id' | 'created_at' | 'status'>,
): Promise<number | null> => {
  try {
    const db = await getDB();
    const createdAt = Date.now();
    const [result] = await db.executeSql(
      `INSERT INTO quests (title, task, latitude, longitude, radius, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [quest.title, quest.task, quest.latitude, quest.longitude, quest.radius, createdAt],
    );
    return result.insertId ?? null;
  } catch (e) {
    console.error('[MontQuest] addQuest failed:', e);
    return null;
  }
};

export const updateQuest = async (
  id: number,
  quest: Omit<Quest, 'id' | 'created_at' | 'status' | 'completed_at'>,
): Promise<boolean> => {
  try {
    const db = await getDB();
    await db.executeSql(
      `UPDATE quests
       SET title = ?, task = ?, latitude = ?, longitude = ?, radius = ?
       WHERE id = ?`,
      [quest.title, quest.task, quest.latitude, quest.longitude, quest.radius, id],
    );
    return true;
  } catch (e) {
    console.error('[MontQuest] updateQuest failed:', e);
    return false;
  }
};

export const getQuestById = async (id: number): Promise<Quest | null> => {
  try {
    const db = await getDB();
    const [result] = await db.executeSql('SELECT * FROM quests WHERE id = ?', [id]);
    return result.rows.length ? sanitizeQuest(result.rows.item(0)) : null;
  } catch (e) {
    console.error('[MontQuest] getQuestById failed:', e);
    return null;
  }
};

export const getActiveQuests = async (): Promise<Quest[]> => {
  try {
    const db = await getDB();
    const [result] = await db.executeSql(
      "SELECT * FROM quests WHERE status = 'active'",
    );
    return (result.rows.raw() as Record<string, unknown>[]).map(sanitizeQuest);
  } catch (e) {
    console.error('[MontQuest] getActiveQuests failed:', e);
    return [];
  }
};

export const getAllQuests = async (): Promise<Quest[]> => {
  try {
    const db = await getDB();
    const [result] = await db.executeSql(
      'SELECT * FROM quests ORDER BY created_at DESC',
    );
    return (result.rows.raw() as Record<string, unknown>[]).map(sanitizeQuest);
  } catch (e) {
    console.error('[MontQuest] getAllQuests failed:', e);
    return [];
  }
};

export const getQuestHistoryWithTitles = async (): Promise<QuestHistoryEntry[]> => {
  try {
    const db = await getDB();
    const [result] = await db.executeSql(
      `SELECT h.id, h.quest_id, q.title, h.completed_at, h.coins_awarded, h.xp_awarded
       FROM quest_history h
       LEFT JOIN quests q ON q.id = h.quest_id
       ORDER BY h.completed_at DESC`,
    );
    return (
      result.rows.raw() as Record<string, unknown>[]
    ).map((row) => ({
      id: Number(row?.id ?? 0),
      quest_id: Number(row?.quest_id ?? 0),
      title: row?.title == null ? null : String(row.title),
      completed_at: Number(row?.completed_at ?? 0),
      coins_awarded: Number(row?.coins_awarded ?? 0),
      xp_awarded: Number(row?.xp_awarded ?? 0),
    }));
  } catch (e) {
    console.error('[MontQuest] getQuestHistoryWithTitles failed:', e);
    return [];
  }
};

export const deleteQuest = async (id: number): Promise<boolean> => {
  try {
    const db = await getDB();
    await db.executeSql('DELETE FROM quests WHERE id = ?', [id]);
    return true;
  } catch (e) {
    console.error('[MontQuest] deleteQuest failed:', e);
    return false;
  }
};
