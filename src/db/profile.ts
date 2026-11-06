import { getDB } from './database';
import { UserProfile } from '../types';

export const getUserProfile = async (): Promise<UserProfile> => {
  const db = await getDB();
  const [res] = await db.executeSql('SELECT * FROM user_profile WHERE id = 1');
  return res.rows.item(0) as UserProfile;
};
