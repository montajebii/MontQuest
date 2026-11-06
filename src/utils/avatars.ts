/**
 * Pixel avatar sprites (Could-have #2) — pure data so they're testable.
 * Each sprite is an 8×8 char grid; every 5 levels the hero is promoted to
 * the next tier: سرگردان → شمشیرزن → نگهبان → قهرمان → پادشاه.
 * '.' = transparent; other chars map to AVATAR_PALETTE colors.
 */

export interface AvatarSprite {
  name: string;
  grid: string[];
}

export const AVATAR_PALETTE: Record<string, string> = {
  K: '#0b0b12', // near-black outline
  W: '#f8f8f8', // white
  S: '#f0c090', // skin
  G: '#2fbf3f', // green
  Y: '#f8d838', // gold
  R: '#e8283c', // red
  B: '#2858e8', // blue
};

export const AVATAR_SPRITES: AvatarSprite[] = [
  {
    name: 'سرگردان',
    grid: [
      '..KKKK..',
      '.KSSSSK.',
      '.KSKKSK.',
      '..KSSK..',
      '.KGGGGK.',
      'KGKGGKGK',
      '.KKKKKK.',
      '.K.KK.K.',
    ],
  },
  {
    name: 'شمشیرزن',
    grid: [
      '..KKKK.Y',
      '.KSSSSKY',
      '.KSKKSKY',
      '..KSSK.Y',
      '.KBBBBKY',
      'KGKBBKGK',
      '.KKKKKK.',
      '.K.KK.K.',
    ],
  },
  {
    name: 'نگهبان',
    grid: [
      '..KKKK..',
      '.KSSSSK.',
      '.KSKKSK.',
      '.KKGGKK.',
      '.KGGGGK.',
      '.KGWWGK.',
      '.KGGGGK.',
      '.K.KK.K.',
    ],
  },
  {
    name: 'قهرمان',
    grid: [
      '...RR...',
      '.KKKKKK.',
      '.KSSSSK.',
      '.KSKKSK.',
      '.KYYYYK.',
      'KGKYYKGK',
      '.KKKKKK.',
      '.K.KK.K.',
    ],
  },
  {
    name: 'پادشاه',
    grid: [
      '.Y.YY.Y.',
      '.YYYYYY.',
      '.KSSSSK.',
      '.KSKKSK.',
      '.KRRRRK.',
      'KGKRRKGK',
      '.KKKKKK.',
      '.K.KK.K.',
    ],
  },
];

/** Every 5 levels → next tier, clamped to the last sprite. */
export const getAvatarTier = (level: number): number =>
  Math.min(
    AVATAR_SPRITES.length - 1,
    Math.max(0, Math.floor((Math.max(1, level) - 1) / 5)),
  );
