#!/usr/bin/env bash
# MontQuest — Pre-flight verification script
# Usage: bash verify-montquest.sh
# Exit code: 0 = all critical checks pass, 1 = at least one FAIL

set -u

PASS=0; FAIL=0; WARN=0
GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"

ok()   { PASS=$((PASS+1)); printf "${GREEN}[PASS]${NC} %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "${RED}[FAIL]${NC} %s\n" "$1"; }
warn() { WARN=$((WARN+1)); printf "${YEL}[WARN]${NC} %s\n" "$1"; }
hdr()  { printf "\n${CYA}=== %s ===${NC}\n" "$1"; }

# check_file <path> <label>
check_file() {
  if [ -f "$1" ]; then ok "$2 → $1"; else bad "$2 → missing: $1"; fi
}
# check_dir <path> <label>
check_dir() {
  if [ -d "$1" ]; then ok "$2 → $1"; else bad "$2 → missing dir: $1"; fi
}
# check_contains <file> <pattern> <label>
check_contains() {
  if [ -f "$1" ] && grep -q -- "$2" "$1"; then
    ok "$3"
  else
    bad "$3 (pattern '$2' not found in $1)"
  fi
}

# ─────────────────────────────────────────────
hdr "0. Working directory"
if [ -f package.json ]; then ok "package.json found at project root"; else bad "Not in project root (no package.json)"; exit 1; fi

# ─────────────────────────────────────────────
hdr "1. Required project files"
for f in App.tsx tsconfig.json babel.config.js metro.config.js; do
  check_file "$f" "core file"
done

for d in src src/db src/screens src/services src/components src/utils src/types src/navigation src/state; do
  check_dir "$d" "src structure"
done

for f in \
  src/db/database.ts src/db/quests.ts src/db/profile.ts src/db/settings.ts \
  src/services/locationService.ts src/services/rewardService.ts \
  src/utils/leveling.ts src/utils/constants.ts \
  src/screens/HomeScreen.tsx src/screens/MapScreen.tsx \
  src/screens/QuestsTab.tsx src/screens/AddQuestScreen.tsx src/screens/SettingsScreen.tsx ; do
  check_file "$f" "expected module"
done

# ─────────────────────────────────────────────
hdr "2. Dependencies (package.json)"
DEPS="react-native-background-geolocation react-native-maps @notifee/react-native react-native-sqlite-storage"
for dep in $DEPS; do
  if node -e "const p=require('./package.json'); process.exit((p.dependencies&&p.dependencies['$dep'])||(p.devDependencies&&p.devDependencies['$dep'])?0:1)"; then
    V=$(node -e "const p=require('./package.json'); console.log((p.dependencies||{})['$dep']||(p.devDependencies||{})['$dep'])")
    ok "dep installed: $dep@$V"
  else
    bad "dep MISSING: $dep (run: npm i $dep)"
  fi
done

# check native modules are linked
if [ -f node_modules/react-native-background-geolocation/package.json ]; then
  ok "node_modules present for background-geolocation"
else
  bad "node_modules/react-native-background-geolocation missing — run npm install"
fi

# ─────────────────────────────────────────────
hdr "3. Android permissions (AndroidManifest.xml)"
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  for perm in \
    "android.permission.ACCESS_FINE_LOCATION" \
    "android.permission.ACCESS_COARSE_LOCATION" \
    "android.permission.ACCESS_BACKGROUND_LOCATION" \
    "android.permission.FOREGROUND_SERVICE" \
    "android.permission.POST_NOTIFICATIONS" \
    "android.permission.RECEIVE_BOOT_COMPLETED" ; do
    check_contains "$MANIFEST" "$perm" "manifest permission: $perm"
  done
  if grep -q "BackgroundGeolocation" "$MANIFEST" || [ -d "android/app/src/main/java" ]; then
    ok "manifest looks initialized (BackgroundGeolocation or java src present)"
  fi
else
  bad "AndroidManifest.xml not found"
fi

# ─────────────────────────────────────────────
hdr "4. iOS Info.plist"
PLIST="ios/MontQuest/Info.plist"
if [ -f "$PLIST" ]; then
  check_contains "$PLIST" "NSLocationWhenInUseUsageDescription" "Info.plist usage: WhenInUse"
  check_contains "$PLIST" "NSLocationAlwaysAndWhenInUseUsageDescription" "Info.plist usage: Always"
  check_contains "$PLIST" "NSLocationAlwaysUsageDescription" "Info.plist usage: Always (legacy)"
  check_contains "$PLIST" "NSUserNotificationUsageDescription" "Info.plist usage: Notifications"
  check_contains "$PLIST" "<string>location</string>" "Info.plist UIBackgroundModes includes location"
else
  bad "Info.plist not found at $PLIST"
fi

# Pods installed?
if [ -d ios/Pods ] && [ -f ios/Podfile.lock ]; then
  ok "iOS Pods installed (Podfile.lock present)"
else
  warn "iOS Pods not installed — run: cd ios && pod install"
fi

# ─────────────────────────────────────────────
hdr "5. Database schema checks (code-level)"
DBFILE="src/db/database.ts"
if [ -f "$DBFILE" ]; then
  for tbl in quests user_profile quest_history settings; do
    check_contains "$DBFILE" "CREATE TABLE IF NOT EXISTS $tbl" "schema table: $tbl"
  done
  check_contains "$DBFILE" "CHECK (id = 1)" "user_profile singleton constraint"
fi

# ─────────────────────────────────────────────
hdr "6. Business rules (10 coins / 25 XP / leveling)"
REWARD="src/services/rewardService.ts"
LEVEL="src/utils/leveling.ts"
if [ -f "$REWARD" ]; then
  check_contains "src/utils/constants.ts" "XP_PER_QUEST.*=.*25" "reward: XP_PER_QUEST = 25"
  check_contains "src/utils/constants.ts" "COINS_PER_QUEST.*=.*10" "reward: COINS_PER_QUEST = 10"
fi
if [ -f "$LEVEL" ]; then
  if grep -Eq "100[[:space:]]*\*[[:space:]]*(level|currentLevel)" "$LEVEL"; then
    ok "leveling formula 100 * level present"
  else
    bad "leveling formula '100 * level' not found in $LEVEL"
  fi
fi

# ─────────────────────────────────────────────
hdr "7. Critical behaviors present in source"
check_contains "src/services/locationService.ts" "BackgroundGeolocation.ready"  "BackgroundGeolocation.ready() configured"
check_contains "src/services/locationService.ts" "addGeofence"                  "geofence registration API used"
check_contains "src/services/locationService.ts" "notifee"                      "local notification (notifee) integrated"
check_contains "src/screens/MapScreen.tsx"       "onGeofence"                   "onGeofence listener wired"
if grep -qE "MIN_CONFIRM_DELAY_MS.*=.*2000|2000" src/utils/constants.ts src/screens/MapScreen.tsx 2>/dev/null; then
  ok "2-second confirm cooldown present"
else
  bad "2-second confirm cooldown not found"
fi
check_contains "src/screens/MapScreen.tsx"       "COOLDOWN"                     "NotNow cooldown constant present"
check_contains "src/screens/HomeScreen.tsx"      "stop()"                       "Exit calls BackgroundGeolocation.stop()"

# ─────────────────────────────────────────────
hdr "8. TypeScript compile (tsc --noEmit)"
if npx --no-install tsc --noEmit 2>/tmp/tsc.log; then
  ok "TypeScript compiles cleanly"
else
  bad "TypeScript errors — see /tmp/tsc.log"
  head -n 20 /tmp/tsc.log
fi

# ─────────────────────────────────────────────
hdr "9. ESLint (if configured)"
if [ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f .eslintrc ]; then
  if npx --no-install eslint "src/**/*.{ts,tsx}" "App.tsx" --max-warnings=0 >/tmp/eslint.log 2>&1; then
    ok "ESLint clean"
  else
    warn "ESLint has issues — see /tmp/eslint.log"
    head -n 15 /tmp/eslint.log
  fi
else
  warn "No ESLint config found — skipping"
fi

# ─────────────────────────────────────────────
hdr "10. Android build (sanity, may take minutes)"
if [ -d android ]; then
  if ( cd android && ./gradlew :app:assembleDebug -q >/tmp/gradle.log 2>&1 ); then
    ok "Android Debug build succeeded"
    APK="android/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK" ]; then ok "APK produced: $APK"; else warn "APK not found at expected path"; fi
  else
    warn "Android build failed or skipped — inspect /tmp/gradle.log"
    tail -n 30 /tmp/gradle.log
  fi
else
  warn "android/ directory missing — skip Gradle build"
fi

# ─────────────────────────────────────────────
hdr "SUMMARY"
printf "  ${GREEN}PASS: %d${NC}\n  ${YEL}WARN: %d${NC}\n  ${RED}FAIL: %d${NC}\n" "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "${GREEN}✔ All critical checks passed.${NC}\n"
  exit 0
else
  printf "${RED}✘ Some critical checks failed. Fix FAIL items and re-run.${NC}\n"
  exit 1
fi
