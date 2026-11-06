import { getDB } from './database';
import { Quest, QuestHistoryEntry } from '../types';

export const addQuest = async (quest: Omit<Quest, 'id' | 'created_at' | 'status'>) => {
  const db = await getDB();
  const createdAt = Date.now();
  const [result] = await db.executeSql(
    `INSERT INTO quests (title, task, latitude, longitude, radius, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [quest.title, quest.task, quest.latitude, quest.longitude, quest.radius, createdAt],
  );
  return result.insertId;
};

export const getActiveQuests = async (): Promise<Quest[]> => {
  const db = await getDB();
  const [result] = await db.executeSql('SELECT * FROM quests WHERE status = \'active\'');
  return result.rows.raw() as Quest[];
};

export const getAllQuests = async (): Promise<Quest[]> => {
  const db = await getDB();
  const [result] = await db.executeSql('SELECT * FROM quests ORDER BY created_at DESC');
  return result.rows.raw() as Quest[];
};

export const getQuestById = async (id: number): Promise<Quest | null> => {
  const db = await getDB();
  const [result] = await db.executeSql('SELECT * FROM quests WHERE id = ?', [id]);
  return result.rows.length ? (result.rows.item(0) as Quest) : null;
};

/** Edits title/task/position/radius of an existing quest (Could-have #4). */
export const updateQuest = async (
  id: number,
  quest: Omit<Quest, 'id' | 'created_at' | 'status' | 'completed_at'>,
): Promise<void> => {
  const db = await getDB();
  await db.executeSql(
    `UPDATE quests
     SET title = ?, task = ?, latitude = ?, longitude = ?, radius = ?
     WHERE id = ?`,
    [quest.title, quest.task, quest.latitude, quest.longitude, quest.radius, id],
  );
};

export const getQuestHistoryWithTitles = async (): Promise<QuestHistoryEntry[]> => {
  const db = await getDB();
  const [result] = await db.executeSql(
    `SELECT h.id, h.quest_id, q.title, h.completed_at, h.coins_awarded, h.xp_awarded
     FROM quest_history h
     LEFT JOIN quests q ON q.id = h.quest_id
     ORDER BY h.completed_at DESC`,
  );
  return result.rows.raw() as QuestHistoryEntry[];
};

export const markQuestCompleted = async (id: number) => {
  const db = await getDB();
  const now = Date.now();
  await db.executeSql('UPDATE quests SET status = \'completed\', completed_at = ? WHERE id = ?', [now, id]);
};

export const deleteQuest = async (id: number) => {
  const db = await getDB();
  await db.executeSql('DELETE FROM quests WHERE id = ?', [id]);
};
