import { describe, it, expect } from '@jest/globals';
import {
  AVATAR_PALETTE,
  AVATAR_SPRITES,
  getAvatarTier,
} from '../src/utils/avatars';

describe('avatar sprites (Could-have #2)', () => {
  it('defines 5 tiers, each an 8×8 grid of palette chars', () => {
    expect(AVATAR_SPRITES).toHaveLength(5);
    for (const sprite of AVATAR_SPRITES) {
      expect(sprite.grid).toHaveLength(8);
      for (const row of sprite.grid) {
        expect(row).toHaveLength(8);
        for (const ch of row) {
          expect(ch === '.' || ch in AVATAR_PALETTE).toBe(true);
        }
      }
    }
  });

  it('uses every tier name exactly once', () => {
    const names = AVATAR_SPRITES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('promotes the hero every 5 levels, clamped to the last tier', () => {
    expect(getAvatarTier(1)).toBe(0);
    expect(getAvatarTier(5)).toBe(0);
    expect(getAvatarTier(6)).toBe(1);
    expect(getAvatarTier(11)).toBe(2);
    expect(getAvatarTier(21)).toBe(4);
    expect(getAvatarTier(99)).toBe(4); // clamped
    expect(getAvatarTier(0)).toBe(0); // defensive clamp
  });
});
