import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

let dbPromise: Promise<any> | null = null;

export const getDB = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabase({ name: 'montquest.db', location: 'default' });
  }
  return dbPromise;
};

export const initDB = async () => {
  const db = await getDB();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      coins INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      current_xp INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS quest_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      coins_awarded INTEGER NOT NULL,
      xp_awarded INTEGER NOT NULL,
      FOREIGN KEY (quest_id) REFERENCES quests(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `INSERT OR IGNORE INTO user_profile (id, coins, level, current_xp, total_xp)
      VALUES (1, 0, 1, 0, 0)`,
  ];
  for (const sql of stmts) {
    await db.executeSql(sql);
  }
};
