import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { AppState, NativeEventSubscription } from 'react-native';
import { initDB } from '../db/database';
import { getUserProfile } from '../db/profile';
import { UserProfile } from '../types';
import {
  configureBackgroundGeolocation,
  startTracking,
  syncGeofences,
} from '../services/locationService';

interface GameContextValue {
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const p = await getUserProfile();
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await initDB();
      try {
        await configureBackgroundGeolocation();
      } catch {}
      if (!mounted) {return;}
      await refreshProfile();
      setLoading(false);
      try {
        await syncGeofences();
        await startTracking(); // respects the tracking_enabled setting
      } catch {}
    })();

    // Spec §6 STOPPED → IDLE: re-entering the app restarts tracking with the
    // saved settings, unless the user disabled it in Options (startTracking
    // checks `tracking_enabled` first).
    const sub: NativeEventSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          startTracking().catch(() => {});
        }
      },
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return (
    <GameContext.Provider value={{ profile, loading, refreshProfile }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) {throw new Error('useGame must be inside GameProvider');}
  return ctx;
};
