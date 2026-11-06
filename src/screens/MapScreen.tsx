import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import EdgeFlashOverlay from '../components/EdgeFlashOverlay';
import XPBar from '../components/XPBar';
import QuestsTab from './QuestsTab';
import { getActiveQuests, getAllQuests, getQuestById } from '../db/quests';
import { completeQuestAndReward } from '../services/rewardService';
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

/**
 * Play screen (spec §4): TopBar (Coins|Level|XP), map with quest markers,
 * FAB for adding quests, bottom tabs [Map][Quests], and the nearby state
 * machine of spec §6.
 */
const MapScreen = ({ navigation }: any) => {
  const { refreshProfile } = useGame();
  const [tab, setTab] = useState<'map' | 'quests'>('map');
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [allQuests, setAllQuests] = useState<Quest[]>([]);

  const [nearbyQuestId, setNearbyQuestId] = useState<number | null>(null);
  const [nearbyTitle, setNearbyTitle] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [edgeFlash, setEdgeFlash] = useState(false);

  const lastPromptRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkRef = useRef<() => Promise<void>>(async () => {});

  const loadQuests = useCallback(async () => {
    setActiveQuests(await getActiveQuests());
    setAllQuests(await getAllQuests());
  }, []);

  // Reload whenever the screen regains focus (e.g. returning from the
  // AddQuest modal).
  useFocusEffect(
    useCallback(() => {
      loadQuests().catch(() => {});
    }, [loadQuests]),
  );

  /** IDLE → NEARBY_PROMPT (spec §6): edge flash + dialog, confirm delayed 2s. */
  const triggerNearby = useCallback((questId: number, title: string) => {
    const now = Date.now();
    if (now - lastPromptRef.current < COOLDOWN_MS) {return;} // AC-14
    lastPromptRef.current = now;
    setNearbyQuestId(questId);
    setNearbyTitle(title);
    setDialogVisible(true);
    setConfirmEnabled(false); // AC-06: no accidental confirm
    setEdgeFlash(true);
    confirmTimerRef.current = setTimeout(
      () => setConfirmEnabled(true),
      MIN_CONFIRM_DELAY_MS,
    );
  }, []);

  const closeNearbyUi = useCallback(() => {
    if (confirmTimerRef.current) {clearTimeout(confirmTimerRef.current);}
    confirmTimerRef.current = null;
    setDialogVisible(false);
    setNearbyQuestId(null);
    setNearbyTitle('');
    setEdgeFlash(false);
  }, []);

  /** One proximity pass: current position vs. every active quest (AC-02). */
  const runProximityCheck = useCallback(async () => {
    try {
      if (!(await isTrackingEnabled())) {return;}
      const pos = await getCurrentLocation();
      console.log(
        `[MontQuest] position check @ ${new Date().toISOString()} ` +
          `${pos.latitude.toFixed(5)},${pos.longitude.toFixed(5)}`,
      );
      const quests = await getActiveQuests();
      for (const q of quests) {
        const dist = haversineMeters(pos.latitude, pos.longitude, q.latitude, q.longitude);
        if (dist <= q.radius) {
          if (AppState.currentState === 'active') {
            triggerNearby(q.id, q.title);
          }
          break;
        }
      }
    } catch {}
  }, [triggerNearby]);

  useEffect(() => {
    checkRef.current = runProximityCheck;
  }, [runProximityCheck]);

  // Foreground periodic check (AC-03). The interval is re-read from the
  // settings DB every cycle so changes in Options apply without restart.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      await checkRef.current();
      if (cancelled) {return;}
      const minutes = await getCheckIntervalMinutes();
      timer = setTimeout(loop, Math.max(1, minutes) * 60_000);
    };
    loop();
    return () => {
      cancelled = true;
      if (timer) {clearTimeout(timer);}
    };
  }, []);

  // Native geofence events — foreground AND background while JS is alive
  // (Android keeps JS alive via the foreground service; AC-05/AC-10).
  useEffect(() => {
    const sub = BackgroundGeolocation.onGeofence(async (event) => {
      if (event.action !== 'ENTER') {return;}
      const questId = Number(event.extras?.questId);
      if (!Number.isFinite(questId)) {return;}
      const quest = await getQuestById(questId);
      if (!quest || quest.status !== 'active') {return;}
      // AC-05: local notification in every app state.
      await showNearbyNotification(quest.title).catch(() => {});
      if (AppState.currentState === 'active') {
        triggerNearby(quest.id, quest.title);
      }
    });
    return () => sub.remove();
  }, [triggerNearby]);

  // Re-entering the app: re-evaluate proximity (spec §6 — backgrounded
  // NEARBY_PROMPT is re-assessed on return).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkRef.current().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => closeNearbyUi, [closeNearbyUi]);

  /** NEARBY_PROMPT → Confirm: reward transaction, history, geofence teardown. */
  const handleConfirm = async () => {
    if (nearbyQuestId === null) {return;}
    try {
      const reward = await completeQuestAndReward(nearbyQuestId);
      if (reward) {await refreshProfile();}
      await loadQuests();
      await syncGeofences();
    } catch {}
    closeNearbyUi();
  };

  /** NEARBY_PROMPT → Not now: cooldown is enforced in triggerNearby (AC-14). */
  const handleNotNow = () => {
    closeNearbyUi();
  };

  const handleQuestsChanged = useCallback(() => {
    loadQuests().catch(() => {});
  }, [loadQuests]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarMain}>
          <XPBar />
        </View>
        <PixelButton
          title="خانه"
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
        />
      </View>

      <View style={styles.body}>
        {tab === 'map' ? (
          <View style={styles.mapWrap}>
            <MapView style={StyleSheet.absoluteFill} showsUserLocation>
              {allQuests.map((q) => (
                <Marker
                  key={q.id}
                  coordinate={{ latitude: q.latitude, longitude: q.longitude }}
                  title={q.title}
                  description={q.task}
                  pinColor={q.status === 'active' ? '#00e676' : '#9e9e9e'}
                />
              ))}
              {activeQuests.map((q) => (
                <Circle
                  key={`c-${q.id}`}
                  center={{ latitude: q.latitude, longitude: q.longitude }}
                  radius={q.radius}
                  strokeWidth={1}
                  strokeColor="rgba(0,230,118,0.6)"
                  fillColor="rgba(0,230,118,0.08)"
                />
              ))}
            </MapView>
            <TouchableOpacity
              style={styles.fab}
              accessibilityLabel="افزودن کوئست"
              onPress={() => navigation.navigate('AddQuest')}>
              <Text style={styles.fabTxt}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <QuestsTab navigation={navigation} onChanged={handleQuestsChanged} />
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'map' && styles.tabActive]}
          onPress={() => setTab('map')}>
          <Text style={[styles.tabTxt, tab === 'map' && styles.tabTxtActive]}>نقشه</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'quests' && styles.tabActive]}
          onPress={() => setTab('quests')}>
          <Text style={[styles.tabTxt, tab === 'quests' && styles.tabTxtActive]}>
            کوئست‌ها
          </Text>
        </TouchableOpacity>
      </View>

      <EdgeFlashOverlay visible={edgeFlash} />

      <Modal
        visible={dialogVisible}
        transparent
        animationType="fade"
        onRequestClose={handleNotNow}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{nearbyTitle}</Text>
            <Text style={styles.dialogText}>آیا کار این کوئست را انجام دادید؟</Text>
            <PixelButton title="تأیید" disabled={!confirmEnabled} onPress={handleConfirm} />
            <PixelButton title="فعلاً نه" onPress={handleNotNow} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  topBarMain: { flex: 1 },
  homeBtn: { marginTop: 8, marginHorizontal: 8 },
  body: { flex: 1 },
  mapWrap: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 56,
    height: 56,
    backgroundColor: '#111',
    borderWidth: 3,
    borderColor: '#0ff',
    shadowColor: '#f0f',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabTxt: { color: '#0ff', fontSize: 28, lineHeight: 32, fontWeight: 'bold' },
  tabs: {
    flexDirection: 'row-reverse',
    borderTopWidth: 3,
    borderTopColor: '#fff',
    backgroundColor: '#000',
  },
  tabBtn: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#111', borderTopColor: '#0ff' },
  tabTxt: { color: '#888', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 },
  tabTxtActive: { color: '#0ff', fontWeight: 'bold' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: '#111', borderColor: '#fff', borderWidth: 3, padding: 16 },
  dialogTitle: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogText: { color: '#fff', fontFamily: 'monospace', fontSize: 16, marginBottom: 12 },
});

export default MapScreen;
