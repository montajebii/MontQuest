import Sound from 'react-native-sound';
import { getSetting, setSetting } from '../db/settings';
import { SETTING_SOUND_ENABLED } from '../utils/constants';

/**
 * 8-bit chiptune SFX (Could-have #1). Files are tiny hand-generated WAVs
 * (see scripts/gen-sfx.js):
 *   Android → res/raw/sfx_*.wav (picked up by MAIN_BUNDLE automatically)
 *   iOS     → ios/MontQuest/Sounds/sfx_*.wav (must be added to the Xcode
 *             target once — see RELEASE_CHECKLIST.md); if a file is not in
 *             the bundle, playback is skipped silently.
 * Gated by the `sound_enabled` setting (default: on).
 */

export type SfxName = 'nearby' | 'reward' | 'levelup';

let sounds: Record<SfxName, Sound> | null = null;
let categorySet = false;

const loadSounds = (): Record<SfxName, Sound> => {
  if (!sounds) {
    if (!categorySet) {
      Sound.setCategory('Playback', true); // mixes with other audio
      categorySet = true;
    }
    sounds = {
      nearby: new Sound('sfx_nearby.wav', Sound.MAIN_BUNDLE),
      reward: new Sound('sfx_reward.wav', Sound.MAIN_BUNDLE),
      levelup: new Sound('sfx_levelup.wav', Sound.MAIN_BUNDLE),
    };
  }
  return sounds;
};

export const isSoundEnabled = async (): Promise<boolean> => {
  const raw = await getSetting(SETTING_SOUND_ENABLED);
  return raw === null ? true : raw === 'true';
};

export const setSoundEnabled = async (enabled: boolean): Promise<void> => {
  await setSetting(SETTING_SOUND_ENABLED, String(enabled));
};

/** Fire-and-forget blip; never throws and never blocks the caller. */
export const playSfx = async (name: SfxName): Promise<void> => {
  try {
    if (!(await isSoundEnabled())) {return;}
    const sfx = loadSounds()[name];
    if (!sfx.isLoaded()) {return;} // asset not bundled (e.g. iOS pre-setup)
    sfx.stop();
    sfx.setCurrentTime(0);
    sfx.play();
  } catch {}
};
