export interface LevelState {
  level: number;
  current_xp: number;
  total_xp: number;
  coins: number;
}

export const applyXP = (state: LevelState, xpGained: number): LevelState => {
  let { level, current_xp, total_xp, coins } = state;
  current_xp += xpGained;
  total_xp += xpGained;

  let xpToNext = 100 * level;
  while (current_xp >= xpToNext) {
    current_xp -= xpToNext;
    level += 1;
    xpToNext = 100 * level;
  }
  return { level, current_xp, total_xp, coins };
};

export const xpForLevel = (level: number): number => 100 * level;
