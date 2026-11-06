#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
[ -f package.json ] || { echo "Run from project root"; exit 1; }

BK=".fix-backup/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"
echo "Backups → $BK"

GREEN="\033[0;32m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok(){ printf "${GREEN}[OK]${NC} %s\n" "$1"; }
warn(){ printf "${YEL}[WARN]${NC} %s\n" "$1"; }
hdr(){ printf "\n${CYA}── %s ──${NC}\n" "$1"; }

# ─────────────────────────────────────────────
hdr "1/10  database.ts — split SQL + cache DB handle"
cp src/db/database.ts "$BK/database.ts"
cat > src/db/database.ts <<'EOF'
import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

let dbPromise: Promise<any> | null = null;

export const getDB = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabase({ name: 'montquest.db', location: 'default' });
  }
  return dbPromise;
};

export const initDB = async () => {
  const db = await getDB();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      coins INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      current_xp INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS quest_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      coins_awarded INTEGER NOT NULL,
      xp_awarded INTEGER NOT NULL,
      FOREIGN KEY (quest_id) REFERENCES quests(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `INSERT OR IGNORE INTO user_profile (id, coins, level, current_xp, total_xp)
      VALUES (1, 0, 1, 0, 0)`,
  ];
  for (const sql of stmts) {
    await db.executeSql(sql);
  }
};
EOF
ok "database.ts rewritten"

# ─────────────────────────────────────────────
hdr "2/10  rewardService.ts — idempotent completion"
cp src/services/rewardService.ts "$BK/rewardService.ts"
cat > src/services/rewardService.ts <<'EOF'
import { getDB } from '../db/database';
import { applyXP } from '../utils/leveling';
import { XP_PER_QUEST, COINS_PER_QUEST } from '../utils/constants';

export const completeQuestAndReward = async (questId: number) => {
  const db = await getDB();
  const now = Date.now();

  await db.executeSql('BEGIN TRANSACTION');
  try {
    const [upd] = await db.executeSql(
      "UPDATE quests SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'active'",
      [now, questId],
    );
    if (upd.rowsAffected === 0) {
      await db.executeSql('ROLLBACK');
      return null;
    }

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

    await db.executeSql('COMMIT');
    return newState;
  } catch (e) {
    await db.executeSql('ROLLBACK');
    throw e;
  }
};
EOF
ok "rewardService.ts rewritten (returns null if already completed)"

# ─────────────────────────────────────────────
hdr "3/10  locationService.ts — remove before add"
cp src/services/locationService.ts "$BK/locationService.ts"
python3 - <<'PY'
p = 'src/services/locationService.ts'
c = open(p).read()
old = """export const syncGeofences = async () => {
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
};"""
new = """export const syncGeofences = async () => {
  await BackgroundGeolocation.removeGeofences();
  const quests = await getActiveQuests();
  if (quests.length === 0) {return;}
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
};"""
if old in c:
    open(p, 'w').write(c.replace(old, new)); print("patched syncGeofences")
else:
    print("WARN: syncGeofences pattern not found")
PY
ok "locationService.ts processed"

# ─────────────────────────────────────────────
hdr "4/10  GameContext.tsx — configure BG + initDB + sync on startup"
cp src/state/GameContext.tsx "$BK/GameContext.tsx"
python3 - <<'PY'
p = 'src/state/GameContext.tsx'
c = open(p).read()
c = c.replace(
  "import { UserProfile } from '../types';",
  "import { UserProfile } from '../types';\n"
  "import {\n  configureBackgroundGeolocation,\n  syncGeofences,\n} from '../services/locationService';\n"
  "import { DEFAULT_TRACKING_INTERVAL_MINUTES } from '../utils/constants';"
)
old = """  useEffect(() => {
    (async () => {
      await initDB();
      await refreshProfile();
      setLoading(false);
    })();
  }, []);"""
new = """  useEffect(() => {
    (async () => {
      try {
        await configureBackgroundGeolocation(DEFAULT_TRACKING_INTERVAL_MINUTES);
      } catch {}
      await initDB();
      await refreshProfile();
      setLoading(false);
      try {
        await syncGeofences();
      } catch {}
    })();
  }, []);"""
if old in c:
    open(p, 'w').write(c.replace(old, new)); print("patched GameContext")
else:
    print("WARN: GameContext pattern not found")
PY
ok "GameContext.tsx processed"

# ─────────────────────────────────────────────
hdr "5/10  App.tsx — drop duplicate config (now in GameContext)"
cp App.tsx "$BK/App.tsx"
cat > App.tsx <<'EOF'
import React from 'react';
import { StatusBar } from 'react-native';
import { GameProvider } from './src/state/GameContext';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => (
  <GameProvider>
    <StatusBar barStyle="light-content" backgroundColor="#000" />
    <AppNavigator />
  </GameProvider>
);

export default App;
EOF
ok "App.tsx rewritten"

# ─────────────────────────────────────────────
hdr "6/10  MapScreen.tsx — constants + resync + null reward check"
cp src/screens/MapScreen.tsx "$BK/MapScreen.tsx"
python3 - <<'PY'
p = 'src/screens/MapScreen.tsx'
c = open(p).read()

c = c.replace(
  "import { MIN_CONFIRM_DELAY_MS } from '../utils/constants';",
  "import { MIN_CONFIRM_DELAY_MS, DEFAULT_COOLDOWN_MINUTES } from '../utils/constants';\n"
  "import { syncGeofences } from '../services/locationService';"
)
c = c.replace(
  "const COOLDOWN_MS = 2 * 60 * 1000;",
  "const COOLDOWN_MS = DEFAULT_COOLDOWN_MINUTES * 60 * 1000;"
)
old = """  const handleConfirm = async () => {
    if (!nearbyQuest) {return;}
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
  };"""
new = """  const handleConfirm = async () => {
    if (!nearbyQuest) {return;}
    try {
      const reward = await completeQuestAndReward(nearbyQuest.questId);
      if (!reward) {
        Alert.alert('توجه', 'این کوئست قبلاً تکمیل شده است.');
      } else {
        await refreshProfile();
        await loadQuests();
        await syncGeofences();
      }
    } catch (e) {
      Alert.alert('خطا', 'ثبت پاداش انجام نشد.');
    }
    setDialogVisible(false);
    setNearbyQuest(null);
    setEdgeFlash(false);
  };"""
if old in c:
    open(p, 'w').write(c.replace(old, new)); print("patched handleConfirm")
else:
    print("WARN: handleConfirm pattern not found")
PY
ok "MapScreen.tsx processed"

# ─────────────────────────────────────────────
hdr "7/10  QuestsTab.tsx — reachable AddQuest + refresh on focus"
cp src/screens/QuestsTab.tsx "$BK/QuestsTab.tsx"
cat > src/screens/QuestsTab.tsx <<'EOF'
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllQuests } from '../db/quests';
import PixelButton from '../components/PixelButton';
import { Quest } from '../types';

const QuestsTab = ({ navigation }: any) => {
  const [quests, setQuests] = useState<Quest[]>([]);

  const load = useCallback(async () => {
    setQuests(await getAllQuests());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <PixelButton
          title="+ کوئست جدید"
          onPress={() => navigation.navigate('AddQuest')}
        />
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={quests}
        keyExtractor={(q) => String(q.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.status === 'completed' ? '✅' : '⭕'} — {item.task}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>هیچ کوئستی ثبت نشده.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  toolbar: { paddingHorizontal: 12, paddingTop: 12 },
  list: { flex: 1 },
  listContent: { padding: 12 },
  row: { borderBottomColor: '#333', borderBottomWidth: 1, paddingVertical: 8 },
  title: { color: '#0ff', fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold' },
  meta: { color: '#aaa', fontFamily: 'monospace', fontSize: 12 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});

export default QuestsTab;
EOF
ok "QuestsTab.tsx rewritten (Add Quest button wired)"

# ─────────────────────────────────────────────
hdr "8/10  AddQuestScreen.tsx — validate numeric inputs"
cp src/screens/AddQuestScreen.tsx "$BK/AddQuestScreen.tsx"
python3 - <<'PY'
p = 'src/screens/AddQuestScreen.tsx'
c = open(p).read()
old = """  const handleSave = async () => {
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
  };"""
new = """  const handleSave = async () => {
    if (!title.trim() || !task.trim()) {
      Alert.alert('خطا', 'عنوان و شرح الزامی است');
      return;
    }
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    const radN = parseFloat(radius);
    if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
      Alert.alert('خطا', 'عرض جغرافیایی باید عددی بین -90 و 90 باشد');
      return;
    }
    if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
      Alert.alert('خطا', 'طول جغرافیایی باید عددی بین -180 و 180 باشد');
      return;
    }
    if (!Number.isFinite(radN) || radN <= 0) {
      Alert.alert('خطا', 'شعاع باید عددی مثبت باشد');
      return;
    }
    try {
      await addQuest({
        title: title.trim(),
        task: task.trim(),
        latitude: latN,
        longitude: lngN,
        radius: radN,
      });
      await syncGeofences();
      navigation.goBack();
    } catch (e) {
      Alert.alert('خطا', 'ذخیره کوئست انجام نشد');
    }
  };"""
if old in c:
    open(p, 'w').write(c.replace(old, new)); print("patched handleSave")
else:
    print("WARN: handleSave pattern not found")
PY
ok "AddQuestScreen.tsx processed"

# ─────────────────────────────────────────────
hdr "9/10  Info.plist + AndroidManifest — iOS description + Android 14 FGS"
cp ios/MontQuest/Info.plist "$BK/Info.plist"
python3 - <<'PY'
p = 'ios/MontQuest/Info.plist'
c = open(p).read()
old = "\t<key>NSLocationWhenInUseUsageDescription</key>\n\t<string></string>"
new = "\t<key>NSLocationWhenInUseUsageDescription</key>\n\t<string>برای نمایش موقعیت شما روی نقشه و کوئست‌های نزدیک</string>"
if old in c:
    open(p, 'w').write(c.replace(old, new)); print("patched Info.plist")
else:
    print("WARN: Info.plist pattern not found")
PY

cp android/app/src/main/AndroidManifest.xml "$BK/AndroidManifest.xml"
python3 - <<'PY'
p = 'android/app/src/main/AndroidManifest.xml'
c = open(p).read()
if 'FOREGROUND_SERVICE_LOCATION' not in c:
    c = c.replace(
      '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
      '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />'
    )
    open(p, 'w').write(c); print("patched AndroidManifest")
else:
    print("FOREGROUND_SERVICE_LOCATION already present")
PY
ok "Permissions processed"

# ─────────────────────────────────────────────
hdr "10/10  Jest mocks for native modules"
cat > jest.setup.js <<'EOF'
jest.mock('react-native-background-geolocation', () => {
  const noop = jest.fn();
  const api = {
    ready: jest.fn(() => Promise.resolve({ enabled: true })),
    onGeofence: jest.fn(() => ({ remove: noop })),
    addGeofences: jest.fn(() => Promise.resolve()),
    removeGeofences: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve(3)),
    stop: jest.fn(() => Promise.resolve()),
    start: jest.fn(() => Promise.resolve()),
    DesiredAccuracy: { High: 0, Medium: 10, Low: 100, Navigation: -1 },
    LogLevel: { Off: 0, Error: 1, Warning: 2, Info: 3, Debug: 4, Verbose: 5 },
    AuthorizationStatus: {
      NotDetermined: 0, Restricted: 1, Denied: 2, Always: 3,
      WhenInUse: 4, DeniedAlways: 5,
    },
  };
  return { __esModule: true, default: api, ...api };
});

jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    createChannel: jest.fn(() => Promise.resolve('nearby')),
    displayNotification: jest.fn(() => Promise.resolve('id')),
  };
  return { __esModule: true, default: api, ...api };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = (props: any) => React.createElement(View, props, props.children);
  const MockMarker = (props: any) => React.createElement(View, props);
  return { __esModule: true, default: MockMapView, Marker: MockMarker };
});

jest.mock('react-native-sqlite-storage', () => {
  const makeDb = () => ({
    executeSql: jest.fn(() =>
      Promise.resolve([{
        rows: { length: 0, item: () => null, raw: () => [] },
        rowsAffected: 0,
        insertId: 0,
      }])
    ),
    close: jest.fn(),
  });
  const SQLite = {
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve(makeDb())),
    deleteDatabase: jest.fn(() => Promise.resolve()),
  };
  return { __esModule: true, default: SQLite, ...SQLite };
});
EOF

cp jest.config.js "$BK/jest.config.js"
cat > jest.config.js <<'EOF'
module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
};
EOF
ok "jest.setup.js + jest.config.js written"

# ─────────────────────────────────────────────
hdr "Verify"
if npx --no-install tsc --noEmit 2>/tmp/tsc.log; then
  ok "TypeScript clean ✓"
else
  warn "tsc errors — see /tmp/tsc.log"; head -n 30 /tmp/tsc.log
fi

if npx --no-install jest --silent 2>/tmp/jest.log; then
  ok "Jest passed ✓"
else
  warn "Jest issues — see /tmp/jest.log"; tail -n 30 /tmp/jest.log
fi

echo
echo "Done. Backups: $BK"
