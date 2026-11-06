#!/usr/bin/env bash
# setup-montquest.sh — Bootstrap کامل پروژه MontQuest
set -euo pipefail

PROJECT="MontQuest"

# ─────────────────────────────────────────────────────────────
# ۱. ساخت پروژه با React Native CLI (Bare Workflow)
# ─────────────────────────────────────────────────────────────
echo "▶ در حال ساخت پروژه $PROJECT ..."
npx @react-native-community/cli@latest init "$PROJECT" --version 0.76.0
cd "$PROJECT"

# ─────────────────────────────────────────────────────────────
# ۲. نصب وابستگی‌ها
# ─────────────────────────────────────────────────────────────
echo "▶ نصب وابستگی‌ها ..."
npm install react-native-background-geolocation \
            react-native-maps \
            @notifee/react-native \
            react-native-sqlite-storage

# ─────────────────────────────────────────────────────────────
# ۳. ساخت پوشه‌ها
# ─────────────────────────────────────────────────────────────
mkdir -p src/components src/db src/navigation src/screens \
         src/services src/state src/types src/utils

# ─────────────────────────────────────────────────────────────
# ۴. فایل‌های TypeScript / TSX
# ─────────────────────────────────────────────────────────────

cat > src/types/index.ts <<'EOF'
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

export interface Settings {
  trackingIntervalMinutes: number;
  cooldownMinutes: number;
  notificationsEnabled: boolean;
}
EOF

cat > src/utils/constants.ts <<'EOF'
export const DEFAULT_TRACKING_INTERVAL_MINUTES = 5;
export const DEFAULT_COOLDOWN_MINUTES = 2;
export const DEFAULT_GEOFENCE_RADIUS_M = 100;
export const XP_PER_QUEST = 25;
export const COINS_PER_QUEST = 10;
export const MIN_CONFIRM_DELAY_MS = 2000;
EOF

cat > src/utils/leveling.ts <<'EOF'
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
EOF

cat > src/db/database.ts <<'EOF'
import SQLite from 'react-native-sqlite-storage';
SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

export const getDB = async () => {
  return SQLite.openDatabase({ name: 'montquest.db', location: 'default' });
};

export const initDB = async () => {
  const db = await getDB();
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      coins INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      current_xp INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quest_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      coins_awarded INTEGER NOT NULL,
      xp_awarded INTEGER NOT NULL,
      FOREIGN KEY (quest_id) REFERENCES quests(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO user_profile (id, coins, level, current_xp, total_xp)
      VALUES (1, 0, 1, 0, 0);
  `);
};
EOF

cat > src/db/quests.ts <<'EOF'
import { getDB } from './database';
import { Quest } from '../types';

export const addQuest = async (quest: Omit<Quest, 'id' | 'created_at' | 'status'>) => {
  const db = await getDB();
  const createdAt = Date.now();
  const [result] = await db.executeSql(
    `INSERT INTO quests (title, task, latitude, longitude, radius, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [quest.title, quest.task, quest.latitude, quest.longitude, quest.radius, createdAt],
  );
  return result.insertId;
};

export const getActiveQuests = async (): Promise<Quest[]> => {
  const db = await getDB();
  const [result] = await db.executeSql(`SELECT * FROM quests WHERE status = 'active'`);
  return result.rows.raw() as Quest[];
};

export const getAllQuests = async (): Promise<Quest[]> => {
  const db = await getDB();
  const [result] = await db.executeSql(`SELECT * FROM quests ORDER BY created_at DESC`);
  return result.rows.raw() as Quest[];
};

export const markQuestCompleted = async (id: number) => {
  const db = await getDB();
  const now = Date.now();
  await db.executeSql(`UPDATE quests SET status = 'completed', completed_at = ? WHERE id = ?`, [now, id]);
};

export const deleteQuest = async (id: number) => {
  const db = await getDB();
  await db.executeSql(`DELETE FROM quests WHERE id = ?`, [id]);
};
EOF

cat > src/db/profile.ts <<'EOF'
import { getDB } from './database';
import { UserProfile } from '../types';

export const getUserProfile = async (): Promise<UserProfile> => {
  const db = await getDB();
  const [res] = await db.executeSql('SELECT * FROM user_profile WHERE id = 1');
  return res.rows.item(0) as UserProfile;
};

export const getQuestHistory = async () => {
  const db = await getDB();
  const [res] = await db.executeSql('SELECT * FROM quest_history ORDER BY completed_at DESC');
  return res.rows.raw();
};
EOF

cat > src/db/settings.ts <<'EOF'
import { getDB } from './database';

export const getSetting = async (key: string): Promise<string | null> => {
  const db = await getDB();
  const [res] = await db.executeSql('SELECT value FROM settings WHERE key = ?', [key]);
  return res.rows.length ? res.rows.item(0).value : null;
};

export const setSetting = async (key: string, value: string) => {
  const db = await getDB();
  await db.executeSql(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
};
EOF

cat > src/services/rewardService.ts <<'EOF'
import { getDB } from '../db/database';
import { applyXP } from '../utils/leveling';
import { XP_PER_QUEST, COINS_PER_QUEST } from '../utils/constants';

export const completeQuestAndReward = async (questId: number) => {
  const db = await getDB();
  const now = Date.now();

  await db.executeSql('BEGIN TRANSACTION');
  try {
    const [profileRes] = await db.executeSql('SELECT * FROM user_profile WHERE id = 1');
    const profile = profileRes.rows.item(0);
    const newState = applyXP(
      {
        level: profile.level,
        current_xp: profile.current_xp,
        total_xp: profile.total_xp,
        coins: profile.coins,
      },
      XP_PER_QUEST,
    );
    newState.coins += COINS_PER_QUEST;

    await db.executeSql(
      'UPDATE user_profile SET coins = ?, level = ?, current_xp = ?, total_xp = ? WHERE id = 1',
      [newState.coins, newState.level, newState.current_xp, newState.total_xp],
    );

    await db.executeSql(
      'INSERT INTO quest_history (quest_id, completed_at, coins_awarded, xp_awarded) VALUES (?, ?, ?, ?)',
      [questId, now, COINS_PER_QUEST, XP_PER_QUEST],
    );

    await db.executeSql(
      "UPDATE quests SET status = 'completed', completed_at = ? WHERE id = ?",
      [now, questId],
    );

    await db.executeSql('COMMIT');
    return newState;
  } catch (e) {
    await db.executeSql('ROLLBACK');
    throw e;
  }
};
EOF

cat > src/services/locationService.ts <<'EOF'
import BackgroundGeolocation, { Geofence } from 'react-native-background-geolocation';
import notifee from '@notifee/react-native';
import { getActiveQuests } from '../db/quests';

export const configureBackgroundGeolocation = async (intervalMinutes: number) => {
  await BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 75,
    stopOnTerminate: false,
    startOnBoot: true,
    debug: __DEV__,
    logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    foregroundService: true,
    notification: {
      title: 'MontQuest در حال اجراست',
      text: 'در حال بررسی موقعیت برای کوئست‌های نزدیک',
    },
    geofenceProximityRadius: 500,
    geofenceInitialTriggerEntry: false,
    stopTimeout: intervalMinutes,
    activityRecognitionInterval: 10000,
  });
};

export const syncGeofences = async () => {
  const quests = await getActiveQuests();
  const geofences: Geofence[] = quests.map((q) => ({
    identifier: `quest_${q.id}`,
    latitude: q.latitude,
    longitude: q.longitude,
    radius: q.radius,
    notifyOnEntry: true,
    notifyOnExit: false,
    notifyOnDwell: false,
    extras: { questId: q.id },
  }));
  await BackgroundGeolocation.addGeofences(geofences);
};

export const showNearbyNotification = async (title: string) => {
  await notifee.requestPermission();
  const channelId = await notifee.createChannel({
    id: 'nearby',
    name: 'Nearby Quests',
  });
  await notifee.displayNotification({
    title: 'کوئست نزدیک!',
    body: title,
    android: { channelId, pressAction: { id: 'default' } },
  });
};

export const requestBackgroundPermission = async (): Promise<boolean> => {
  try {
    const status = await BackgroundGeolocation.requestPermission();
    return status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS;
  } catch {
    return false;
  }
};
EOF

# ─── state ───────────────────────────────────────────────────
cat > src/state/GameContext.tsx <<'EOF'
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDB } from '../db/database';
import { getUserProfile } from '../db/profile';
import { UserProfile } from '../types';

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
    (async () => {
      await initDB();
      await refreshProfile();
      setLoading(false);
    })();
  }, []);

  return (
    <GameContext.Provider value={{ profile, loading, refreshProfile }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
};
EOF

# ─── components ──────────────────────────────────────────────
cat > src/components/PixelButton.tsx <<'EOF'
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const PixelButton: React.FC<Props> = ({ title, onPress, disabled, style }) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={[styles.btn, disabled && styles.disabled, style]}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginVertical: 6,
    borderRadius: 0,
    shadowColor: '#f0f',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  disabled: { opacity: 0.4 },
  label: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
});

export default PixelButton;
EOF

cat > src/components/XPBar.tsx <<'EOF'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../state/GameContext';
import { xpForLevel } from '../utils/leveling';

const XPBar: React.FC = () => {
  const { profile } = useGame();
  if (!profile) return null;
  const need = xpForLevel(profile.level);
  const pct = Math.min(1, profile.current_xp / need);
  return (
    <View style={styles.wrap}>
      <Text style={styles.txt}>
        Lv {profile.level} — {profile.current_xp}/{need} XP — 🪙 {profile.coins}
      </Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { padding: 8 },
  txt: { color: '#fff', fontFamily: 'monospace', marginBottom: 4 },
  barBg: { height: 12, backgroundColor: '#222', borderWidth: 2, borderColor: '#fff' },
  barFill: { height: '100%', backgroundColor: '#0f0' },
});

export default XPBar;
EOF

cat > src/components/EdgeFlashOverlay.tsx <<'EOF'
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

const EdgeFlashOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        { iterations: 4 },
      ).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.edge, { opacity }]} />
  );
};

const styles = StyleSheet.create({
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 12,
    borderColor: '#f0f',
  },
});

export default EdgeFlashOverlay;
EOF

# ─── screens ────────────────────────────────────────────────
cat > src/screens/HomeScreen.tsx <<'EOF'
import React from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import PixelButton from '../components/PixelButton';
import XPBar from '../components/XPBar';

const HomeScreen = ({ navigation }: any) => {
  const handleExit = async () => {
    await BackgroundGeolocation.stop();
    BackHandler.exitApp();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MontQuest</Text>
      <XPBar />
      <PixelButton title="Play" onPress={() => navigation.navigate('Map')} />
      <PixelButton title="Quests" onPress={() => navigation.navigate('Quests')} />
      <PixelButton title="Options" onPress={() => navigation.navigate('Settings')} />
      <PixelButton title="Exit" onPress={handleExit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center' },
  title: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
});

export default HomeScreen;
EOF

cat > src/screens/MapScreen.tsx <<'EOF'
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import BackgroundGeolocation from 'react-native-background-geolocation';
import PixelButton from '../components/PixelButton';
import EdgeFlashOverlay from '../components/EdgeFlashOverlay';
import { completeQuestAndReward } from '../services/rewardService';
import { getActiveQuests } from '../db/quests';
import { useGame } from '../state/GameContext';
import { MIN_CONFIRM_DELAY_MS } from '../utils/constants';
import { Quest } from '../types';

const COOLDOWN_MS = 2 * 60 * 1000;

const MapScreen = () => {
  const { refreshProfile } = useGame();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [nearbyQuest, setNearbyQuest] = useState<{ questId: number } | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [edgeFlash, setEdgeFlash] = useState(false);
  const lastPromptRef = useRef<number>(0);

  const loadQuests = async () => {
    setQuests(await getActiveQuests());
  };

  useEffect(() => {
    loadQuests();
    const sub = BackgroundGeolocation.onGeofence((event) => {
      if (event.action === 'ENTER') {
        const now = Date.now();
        if (now - lastPromptRef.current < COOLDOWN_MS) return;
        lastPromptRef.current = now;
        setNearbyQuest({ questId: (event.extras as any).questId });
        setDialogVisible(true);
        setConfirmEnabled(false);
        setEdgeFlash(true);
        setTimeout(() => setConfirmEnabled(true), MIN_CONFIRM_DELAY_MS);
      }
    });
    return () => sub.remove();
  }, []);

  const handleConfirm = async () => {
    if (!nearbyQuest) return;
    try {
      await completeQuestAndReward(nearbyQuest.questId);
      await refreshProfile();
      await loadQuests();
    } catch (e) {
      Alert.alert('خطا', 'ثبت پاداش انجام نشد.');
    }
    setDialogVisible(false);
    setNearbyQuest(null);
    setEdgeFlash(false);
  };

  const handleNotNow = () => {
    setDialogVisible(false);
    setNearbyQuest(null);
    setEdgeFlash(false);
  };

  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFill} showsUserLocation>
        {quests.map((q) => (
          <Marker
            key={q.id}
            coordinate={{ latitude: q.latitude, longitude: q.longitude }}
            title={q.title}
            description={q.task}
          />
        ))}
      </MapView>
      <EdgeFlashOverlay visible={edgeFlash} />
      <Modal visible={dialogVisible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogText}>آیا کار کوئست را انجام دادید؟</Text>
            <PixelButton title="تأیید" disabled={!confirmEnabled} onPress={handleConfirm} />
            <PixelButton title="فعلاً نه" onPress={handleNotNow} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111', borderColor: '#fff', borderWidth: 3, padding: 16 },
  dialogText: { color: '#fff', fontFamily: 'monospace', fontSize: 16, marginBottom: 12 },
});

export default MapScreen;
EOF

cat > src/screens/QuestsTab.tsx <<'EOF'
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { getAllQuests } from '../db/quests';
import { Quest } from '../types';

const QuestsTab = () => {
  const [quests, setQuests] = useState<Quest[]>([]);

  const load = useCallback(async () => {
    setQuests(await getAllQuests());
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <FlatList
      style={styles.list}
      data={quests}
      keyExtractor={(q) => String(q.id)}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.status === 'completed' ? '✅' : '⭕'} — {item.task}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>هیچ کوئستی ثبت نشده.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#000', padding: 12 },
  row: { borderBottomColor: '#333', borderBottomWidth: 1, paddingVertical: 8 },
  title: { color: '#0ff', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' },
  meta: { color: '#aaa', fontFamily: 'monospace', fontSize: 12 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});

export default QuestsTab;
EOF

cat > src/screens/AddQuestScreen.tsx <<'EOF'
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import PixelButton from '../components/PixelButton';
import { addQuest } from '../db/quests';
import { syncGeofences } from '../services/locationService';
import { DEFAULT_GEOFENCE_RADIUS_M } from '../utils/constants';

const AddQuestScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [lat, setLat] = useState('35.6892');
  const [lng, setLng] = useState('51.3890');
  const [radius, setRadius] = useState(String(DEFAULT_GEOFENCE_RADIUS_M));

  const handleSave = async () => {
    if (!title || !task) {
      Alert.alert('خطا', 'عنوان و شرح الزامی است');
      return;
    }
    try {
      await addQuest({
        title,
        task,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseFloat(radius),
      });
      await syncGeofences();
      navigation.goBack();
    } catch (e) {
      Alert.alert('خطا', 'ذخیره کوئست انجام نشد');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>عنوان</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <Text style={styles.label}>شرح کار</Text>
      <TextInput style={styles.input} value={task} onChangeText={setTask} />
      <Text style={styles.label}>عرض جغرافیایی</Text>
      <TextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="numeric" />
      <Text style={styles.label}>طول جغرافیایی</Text>
      <TextInput style={styles.input} value={lng} onChangeText={setLng} keyboardType="numeric" />
      <Text style={styles.label}>شعاع (متر)</Text>
      <TextInput style={styles.input} value={radius} onChangeText={setRadius} keyboardType="numeric" />
      <PixelButton title="ذخیره" onPress={handleSave} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  label: { color: '#0ff', fontFamily: 'monospace', marginTop: 12 },
  input: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 2,
    color: '#fff',
    fontFamily: 'monospace',
    padding: 8,
    marginTop: 4,
  },
});

export default AddQuestScreen;
EOF

cat > src/screens/SettingsScreen.tsx <<'EOF'
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Linking } from 'react-native';
import PixelButton from '../components/PixelButton';
import { getSetting, setSetting } from '../db/settings';
import {
  configureBackgroundGeolocation,
  requestBackgroundPermission,
  syncGeofences,
} from '../services/locationService';
import { DEFAULT_TRACKING_INTERVAL_MINUTES } from '../utils/constants';

const SettingsScreen = () => {
  const [interval, setIntervalValue] = useState(String(DEFAULT_TRACKING_INTERVAL_MINUTES));

  useEffect(() => {
    (async () => {
      const v = await getSetting('trackingIntervalMinutes');
      if (v) setIntervalValue(v);
    })();
  }, []);

  const handleSave = async () => {
    const n = parseInt(interval, 10);
    if (!n || n < 1) {
      Alert.alert('خطا', 'بازه باید عددی مثبت باشد');
      return;
    }
    await setSetting('trackingIntervalMinutes', String(n));
    await configureBackgroundGeolocation(n);
    await syncGeofences();
    Alert.alert('ذخیره شد', 'تنظیمات اعمال شد');
  };

  const handlePermissions = async () => {
    const ok = await requestBackgroundPermission();
    if (!ok) {
      Alert.alert(
        'مجوز پس‌زمینه لازم است',
        'برای ادامه، مجوز موقعیت «همیشه» را از تنظیمات سیستم فعال کنید.',
        [
          { text: 'باز کردن تنظیمات', onPress: () => Linking.openSettings() },
          { text: 'بستن', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>بازه بررسی موقعیت (دقیقه)</Text>
      <TextInput
        style={styles.input}
        value={interval}
        onChangeText={setIntervalValue}
        keyboardType="numeric"
      />
      <PixelButton title="ذخیره" onPress={handleSave} />
      <PixelButton title="درخواست مجوز پس‌زمینه" onPress={handlePermissions} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  label: { color: '#0ff', fontFamily: 'monospace', marginTop: 12 },
  input: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 2,
    color: '#fff',
    fontFamily: 'monospace',
    padding: 8,
    marginTop: 4,
    marginBottom: 12,
  },
});

export default SettingsScreen;
EOF

# ─── navigation ─────────────────────────────────────────────
cat > src/navigation/AppNavigator.tsx <<'EOF'
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import QuestsTab from '../screens/QuestsTab';
import AddQuestScreen from '../screens/AddQuestScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Home: undefined;
  Map: undefined;
  Quests: undefined;
  AddQuest: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#0ff' }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="Quests" component={QuestsTab} />
      <Stack.Screen name="AddQuest" component={AddQuestScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
EOF

# ─── App.tsx ────────────────────────────────────────────────
cat > App.tsx <<'EOF'
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GameProvider } from './src/state/GameContext';
import AppNavigator from './src/navigation/AppNavigator';
import { configureBackgroundGeolocation } from './src/services/locationService';
import { DEFAULT_TRACKING_INTERVAL_MINUTES } from './src/utils/constants';

const App = () => {
  useEffect(() => {
    configureBackgroundGeolocation(DEFAULT_TRACKING_INTERVAL_MINUTES).catch(() => {});
  }, []);

  return (
    <GameProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <AppNavigator />
    </GameProvider>
  );
};

export default App;
EOF

# ─────────────────────────────────────────────────────────────
# ۵. اضافه کردن وابستگی‌های ناوبری
# ─────────────────────────────────────────────────────────────
echo "▶ نصب React Navigation ..."
npm install @react-navigation/native @react-navigation/native-stack \
            react-native-screens react-native-safe-area-context

# ─────────────────────────────────────────────────────────────
# ۶. افزودن مجوزها به AndroidManifest.xml
# ─────────────────────────────────────────────────────────────
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q "ACCESS_BACKGROUND_LOCATION" "$MANIFEST"; then
  echo "▶ افزودن مجوزها به AndroidManifest.xml ..."
  PERMS='    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n'
  sed -i "s|</manifest>|${PERMS}</manifest>|" "$MANIFEST"
fi

# ─────────────────────────────────────────────────────────────
# ۷. افزودن کلیدهای Info.plist برای iOS
# ─────────────────────────────────────────────────────────────
PLIST="ios/MontQuest/Info.plist"
if [ -f "$PLIST" ] && ! grep -q "NSLocationAlwaysAndWhenInUseUsageDescription" "$PLIST"; then
  echo "▶ افزودن کلیدهای موقعیت به Info.plist ..."
  /usr/libexec/PlistBuddy -c "Add :NSLocationWhenInUseUsageDescription string 'برای نمایش موقعیت شما روی نقشه و کوئست‌های نزدیک'" "$PLIST" || true
  /usr/libexec/PlistBuddy -c "Add :NSLocationAlwaysAndWhenInUseUsageDescription string 'برای اطلاع‌رسانی کوئست‌های نزدیک حتی در پس‌زمینه'" "$PLIST" || true
  /usr/libexec/PlistBuddy -c "Add :NSLocationAlwaysUsageDescription string 'برای ردیابی موقعیت در پس‌زمینه'" "$PLIST" || true
  /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST" || true
  /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string location" "$PLIST" || true
fi

# ─────────────────────────────────────────────────────────────
# ۸. README
# ─────────────────────────────────────────────────────────────
cat > README.md <<'EOF'
# MontQuest

اپلیکیشن گیمیفای‌شدهٔ مدیریت کوئست‌های مکانی با تم 8-bit.

## پیش‌نیازها
- Node.js 18+
- React Native CLI
- Android Studio / Xcode
- (برای Release اندروید) لایسنس `react-native-background-geolocation`

## نصب و اجرا
```bash
npm install
cd ios && pod install && cd ..
npx react-native run-android
# یا
npx react-native run-ios
```

## مجوزها
- اندروید: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`
- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: location`

## محدودیت‌های پس‌زمینه
- **iOS**: اگر اپ به‌صورت دستی از App Switcher بسته شود (Force Kill)، iOS رویدادهای موقعیت را متوقف می‌کند. این محدودیت پلتفرمی است.
- **اندروید**: برخی OEMها (شیائومی، هواوی، سامسونگ) ممکن است سرویس پس‌زمینه را kill کنند. راهنمای رفع محدودیت باتری در تنظیمات نمایش داده می‌شود.

## حریم خصوصی
تمام داده‌ها فقط در SQLite محلی ذخیره می‌شوند. هیچ داده‌ای به بیرون ارسال نمی‌شود.
EOF

# ─────────────────────────────────────────────────────────────
# ۹. پایان
# ─────────────────────────────────────────────────────────────
echo ""
echo "✅ پروژه MontQuest با موفقیت ساخته شد."
echo ""
echo "گام‌های بعدی:"
echo "  cd $PROJECT"
echo "  cd ios && pod install && cd ..   # فقط در macOS"
echo "  npx react-native run-android"
echo ""
