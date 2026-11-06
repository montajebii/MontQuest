import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import Sound from 'react-native-sound';
import { SETTING_SOUND_ENABLED } from '../src/utils/constants';

// Controllable settings store (the global sqlite mock doesn't persist rows).
const mockSettingsStore = new Map<string, string>();
jest.mock('../src/db/settings', () => ({
  getSetting: async (key: string) => mockSettingsStore.get(key) ?? null,
  setSetting: async (key: string, value: string) => {
    mockSettingsStore.set(key, value);
  },
}));

import { playSfx, setSoundEnabled } from '../src/services/soundService';

interface MockSoundInstance {
  _name: string;
  playCalls: number;
}

const playsOf = (sfx: string): number =>
  ((Sound as unknown as { _instances: MockSoundInstance[] })._instances)
    .filter((i) => i._name === `sfx_${sfx}.wav`)
    .reduce((sum, i) => sum + i.playCalls, 0);

describe('soundService (Could-have #1)', () => {
  beforeEach(() => {
    mockSettingsStore.clear();
  });

  it('plays sfx by default (sound_enabled unset)', async () => {
    const before = playsOf('reward');
    await playSfx('reward');
    expect(playsOf('reward')).toBe(before + 1);
  });

  it('is silent when sound_enabled = false', async () => {
    await setSoundEnabled(false);
    expect(mockSettingsStore.get(SETTING_SOUND_ENABLED)).toBe('false');
    const before = playsOf('reward');
    await playSfx('reward');
    expect(playsOf('reward')).toBe(before);
  });

  it('plays again after re-enabling', async () => {
    await setSoundEnabled(false);
    const before = playsOf('nearby');
    await playSfx('nearby');
    expect(playsOf('nearby')).toBe(before);

    await setSoundEnabled(true);
    await playSfx('nearby');
    expect(playsOf('nearby')).toBe(before + 1);
  });
});
