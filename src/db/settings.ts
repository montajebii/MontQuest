import { getDB } from './database';

export const getSetting = async (key: string): Promise<string | null> => {
  const db = await getDB();
  const [res] = await db.executeSql('SELECT value FROM settings WHERE key = ?', [key]);
  return res.rows.length ? res.rows.item(0).value : null;
};

export const setSetting = async (key: string, value: string) => {
  const db = await getDB();
  await db.executeSql(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
};
