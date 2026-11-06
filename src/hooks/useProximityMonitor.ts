import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { getActiveQuests, getQuestById } from '../db/quests';
import { completeQuestAndReward, onQuestCompleted } from '../services/rewardService';
import { playSfx } from '../services/soundService';
import {
  getCurrentLocation,
  getCheckIntervalMinutes,
  isTrackingEnabled,
  showNearbyNotification,
  syncGeofences,
} from '../services/locationService';
import { useGame } from '../state/GameContext';
import { DEFAULT_COOLDOWN_MINUTES, MIN_CONFIRM_DELAY_MS } from '../utils/constants';
import { haversineMeters } from '../utils/geo';
import { Quest } from '../types';

const COOLDOWN_MS = DEFAULT_COOLDOWN_MINUTES * 60 * 1000;

export interface NearbyQuestState {
  nearbyQuest: Quest | null;
  isDialogVisible: boolean;
  /** Becomes true MIN_CONFIRM_DELAY_MS after the dialog opens (AC-06). */
  confirmEnabled: boolean;
  edgeFlash: boolean;
  confirm: () => Promise<void>;
  notNow: () => void;
}

/**
 * App-lifetime proximity monitor (spec §6 state machine).
 *
 * Owns everything that previously lived in MapScreen and therefore only
 * worked while the map was mounted:
 *  - the native `onGeofence` listener (foreground AND background, AC-05),
 *  - the periodic foreground position check (AC-03) — the interval is
 *    re-read from settings every cycle; the loop pauses while the app is
 *    backgrounded (native geofencing covers that path) and re-evaluates
 *    immediately on return,
 *  - the 2-minute "Not now" cooldown (AC-14),
 *  - the 2-second confirm-button delay (AC-06).
 */
export const useProximityMonitor = (): NearbyQuestState => {
  const { refreshProfile } = useGame();
  const [nearbyQuest, setNearbyQuest] = useState<Quest | null>(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [edgeFlash, setEdgeFlash] = useState(false);

  const lastPromptRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkRef = useRef<() => Promise<void>>(async () => {});
  const nearbyQuestRef = useRef<Quest | null>(null);
  // Mirrors isDialogVisible synchronously so triggerNearby can refuse to
  // switch the open dialog to a different quest (audit F1.3).
  const dialogOpenRef = useRef(false);

  useEffect(() => {
    nearbyQuestRef.current = nearbyQuest;
  }, [nearbyQuest]);

  const closeNearbyUi = useCallback(() => {
    if (confirmTimerRef.current) {clearTimeout(confirmTimerRef.current);}
    confirmTimerRef.current = null;
    dialogOpenRef.current = false;
    setNearbyQuest(null);
    setIsDialogVisible(false);
    setConfirmEnabled(false);
    setEdgeFlash(false);
  }, []);

  /** IDLE → NEARBY_PROMPT: edge flash + dialog, confirm delayed 2s. */
  const triggerNearby = useCallback((quest: Quest) => {
    // A dialog already on screen must not silently switch to another quest
    // (audit F1.3) — the new quest is picked up after this one is resolved.
    if (dialogOpenRef.current) {return;}
    const now = Date.now();
    if (now - lastPromptRef.current < COOLDOWN_MS) {return;} // AC-14
    lastPromptRef.current = now;
    dialogOpenRef.current = true;
    setNearbyQuest(quest);
    setIsDialogVisible(true);
    setConfirmEnabled(false); // AC-06: no accidental confirm
    setEdgeFlash(true);
    playSfx('nearby').catch(() => {}); // Could-have #1
    confirmTimerRef.current = setTimeout(
      () => setConfirmEnabled(true),
      MIN_CONFIRM_DELAY_MS,
    );
  }, []);

  /** One proximity pass: current position vs. every active quest. */
  const runProximityCheck = useCallback(async () => {
    try {
      if (!(await isTrackingEnabled())) {return;}
      const pos = await getCurrentLocation();
      if (__DEV__) {
        console.log(
          `[MontQuest] position check @ ${new Date().toISOString()} ` +
            `${pos.latitude.toFixed(5)},${pos.longitude.toFixed(5)}`,
        );
      }
      const quests = await getActiveQuests();
      for (const q of quests) {
        const dist = haversineMeters(pos.latitude, pos.longitude, q.latitude, q.longitude);
        if (dist <= q.radius) {
          if (AppState.currentState === 'active') {triggerNearby(q);}
          break;
        }
      }
    } catch {}
  }, [triggerNearby]);

  useEffect(() => {
    checkRef.current = runProximityCheck;
  }, [runProximityCheck]);

  // Native geofence events — stays registered for the app's whole lifetime
  // so proximity works from Home/Settings too and in the background.
  useEffect(() => {
    const sub = BackgroundGeolocation.onGeofence(async (event) => {
      if (event.action !== 'ENTER') {return;}
      const questId = Number(event.extras?.questId);
      if (!Number.isFinite(questId)) {return;}
      const quest = await getQuestById(questId);
      if (!quest || quest.status !== 'active') {return;}
      await showNearbyNotification(quest.title).catch(() => {});
      if (AppState.currentState === 'active') {triggerNearby(quest);}
    });
    return () => sub.remove();
  }, [triggerNearby]);

  // Foreground periodic loop. Backgrounding stops the timer (native
  // geofencing handles the background path); returning restarts it and
  // re-evaluates proximity immediately (spec §6). Every continuation
  // re-checks `cancelled` after its awaits so no timer is ever scheduled
  // after unmount.
  useEffect(() => {
    let cancelled = false;
    let foreground = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stopLoop = () => {
      if (timer) {clearTimeout(timer);}
      timer = null;
    };
    const loop = async () => {
      await checkRef.current();
      if (cancelled) {return;}
      const minutes = await getCheckIntervalMinutes();
      if (cancelled || !foreground) {return;}
      timer = setTimeout(loop, Math.max(1, minutes) * 60_000);
    };
    const startLoop = () => {
      if (cancelled || timer) {return;}
      loop();
    };
    startLoop();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        foreground = true;
        stopLoop();
        startLoop(); // fresh cycle, immediate check
      } else {
        foreground = false;
        stopLoop();
      }
    });
    return () => {
      cancelled = true;
      foreground = false;
      stopLoop();
      sub.remove();
    };
  }, []);

  // Manual completion of the very quest whose dialog is open (e.g. from
  // the Quests tab): close the dialog — completeQuestAndReward already
  // made the awarding idempotent (returns null for a completed quest).
  useEffect(
    () =>
      onQuestCompleted((questId) => {
        const current = nearbyQuestRef.current;
        if (current && current.id === questId) {closeNearbyUi();}
      }),
    [closeNearbyUi],
  );

  useEffect(
    () => () => {
      if (confirmTimerRef.current) {clearTimeout(confirmTimerRef.current);}
    },
    [],
  );

  /** NEARBY_PROMPT → Confirm: reward transaction + geofence teardown. */
  const confirm = useCallback(async () => {
    const quest = nearbyQuestRef.current;
    if (!quest) {
      closeNearbyUi();
      return;
    }
    try {
      const reward = await completeQuestAndReward(quest.id);
      if (reward) {await refreshProfile();}
      await syncGeofences();
    } catch {}
    closeNearbyUi();
  }, [closeNearbyUi, refreshProfile]);

  /** NEARBY_PROMPT → Not now: cooldown is enforced in triggerNearby (AC-14). */
  const notNow = useCallback(() => {
    closeNearbyUi();
  }, [closeNearbyUi]);

  return {
    nearbyQuest,
    isDialogVisible,
    confirmEnabled,
    edgeFlash,
    confirm,
    notNow,
  };
};
