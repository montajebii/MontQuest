export interface Quest {
  id: number;
  title: string;
  task: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: 'active' | 'completed';
  created_at: number;
  completed_at?: number;
}

export interface UserProfile {
  id: number;
  coins: number;
  level: number;
  current_xp: number;
  total_xp: number;
}

export interface QuestHistory {
  id: number;
  quest_id: number;
  completed_at: number;
  coins_awarded: number;
  xp_awarded: number;
}

/** quest_history row joined with the quest title (for the history list). */
export interface QuestHistoryEntry extends QuestHistory {
  title: string | null;
}
