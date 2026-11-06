import { describe, it, expect } from '@jest/globals';
import { applyXP, xpForLevel } from '../src/utils/leveling';
import { COINS_PER_QUEST, XP_PER_QUEST } from '../src/utils/constants';

describe('level formula (AC-08): xpToNextLevel = 100 × level', () => {
  it('computes the per-level threshold', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(200);
    expect(xpForLevel(3)).toBe(300);
  });

  it('levels up exactly at the threshold (4 × 25 XP = 100)', () => {
    let s = { level: 1, current_xp: 0, total_xp: 0, coins: 0 };
    for (let i = 0; i < 4; i++) {
      s = applyXP(s, XP_PER_QUEST);
    }
    expect(s).toMatchObject({ level: 2, current_xp: 0, total_xp: 100 });
  });

  it('carries the remainder into the next level', () => {
    const s = applyXP(
      { level: 1, current_xp: 90, total_xp: 90, coins: 0 },
      XP_PER_QUEST,
    );
    expect(s.level).toBe(2);
    expect(s.current_xp).toBe(15); // 115 − 100
    expect(s.total_xp).toBe(115);
  });

  it('handles multi-level jumps in a single grant', () => {
    const s = applyXP({ level: 1, current_xp: 0, total_xp: 0, coins: 0 }, 600);
    expect(s.level).toBe(4); // 600 − 100 − 200 − 300 = 0
    expect(s.current_xp).toBe(0);
    expect(s.total_xp).toBe(600);
  });

  it('keeps coins untouched', () => {
    const s = applyXP({ level: 1, current_xp: 0, total_xp: 0, coins: 7 }, XP_PER_QUEST);
    expect(s.coins).toBe(7);
  });

  it('game constants match the spec (AC-07)', () => {
    expect(COINS_PER_QUEST).toBe(10);
    expect(XP_PER_QUEST).toBe(25);
  });
});
