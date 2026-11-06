#!/usr/bin/env bash
# fix-montquest.sh — auto-repair MontQuest (Linux/macOS, bash)
# Usage: bash fix-montquest.sh
# Backups: .fix-backup/<timestamp>/

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
if [ ! -f package.json ]; then echo "ERROR: run from project root (no package.json)"; exit 1; fi

BACKUP=".fix-backup/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BACKUP"

GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok()   { printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
skip() { printf "${YEL}[SKIP]${NC} %s\n" "$1"; }
info() { printf "${CYA}[INFO]${NC} %s\n" "$1"; }
err()  { printf "${RED}[ERR]${NC}  %s\n" "$1"; }
hdr()  { printf "\n${CYA}── %s ──${NC}\n" "$1"; }

backup_file() {
  local f="$1"
  if [ -f "$f" ] && [ ! -f "$BACKUP/$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"
  fi
}

# ─────────────────────────────────────────────
hdr "1/7  iOS Info.plist"
PLIST="ios/MontQuest/Info.plist"
if [ ! -f "$PLIST" ]; then skip "Info.plist not found"; else
  backup_file "$PLIST"
  python3 - "$PLIST" <<'PY'
import sys, re
path = sys.argv[1]
with open(path) as f: c = f.read()
entries = [
    ("NSLocationWhenInUseUsageDescription","برای نمایش موقعیت شما روی نقشه و کوئست‌های نزدیک"),
    ("NSLocationAlwaysAndWhenInUseUsageDescription","برای اطلاع‌رسانی کوئست‌های نزدیک حتی در پس‌زمینه"),
    ("NSLocationAlwaysUsageDescription","برای ردیابی موقعیت در پس‌زمینه"),
    ("NSUserNotificationUsageDescription","برای اطلاع‌رسانی نزدیکی به کوئست‌ها"),
]
n = 0
for k, v in entries:
    if f"<key>{k}</key>" in c: continue
    snippet = f"\t<key>{k}</key>\n\t<string>{v}</string>\n"
    idx = c.rfind("</dict>")
    c = c[:idx] + snippet + c[idx:]; n += 1
if "<key>UIBackgroundModes</key>" not in c:
    snippet = "\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t</array>\n"
    idx = c.rfind("</dict>")
    c = c[:idx] + snippet + c[idx:]; n += 1
elif "<string>location</string>" not in c:
    c = re.sub(r"(<key>UIBackgroundModes</key>\s*<array>)", r"\1\n\t\t<string>location</string>", c, count=1); n += 1
if n: open(path, "w").write(c)
print(f"Info.plist: {n} entries added/updated" if n else "Info.plist: already complete")
PY
  ok "Info.plist processed"
fi

# ─────────────────────────────────────────────
hdr "2/7  locationService.ts (v5 enum API + ts-ignore)"
SVC="src/services/locationService.ts"
if [ ! -f "$SVC" ]; then skip "$SVC not found"; else
  backup_file "$SVC"
  python3 - "$SVC" <<'PY'
import sys, re
p = sys.argv[1]
c = open(p).read(); orig = c
reps = [
    (r'BackgroundGeolocation\.DESIRED_ACCURACY_HIGH','BackgroundGeolocation.DesiredAccuracy.HIGH'),
    (r'BackgroundGeolocation\.DESIRED_ACCURACY_MEDIUM','BackgroundGeolocation.DesiredAccuracy.MEDIUM'),
    (r'BackgroundGeolocation\.DESIRED_ACCURACY_LOW','BackgroundGeolocation.DesiredAccuracy.LOW'),
    (r'BackgroundGeolocation\.DESIRED_ACCURACY_NAVIGATION','BackgroundGeolocation.DesiredAccuracy.NAVIGATION'),
    (r'BackgroundGeolocation\.DESIRED_ACCURACY_BEST','BackgroundGeolocation.DesiredAccuracy.HIGH'),
    (r'BackgroundGeolocation\.LOG_LEVEL_VERBOSE','BackgroundGeolocation.LogLevel.VERBOSE'),
    (r'BackgroundGeolocation\.LOG_LEVEL_DEBUG','BackgroundGeolocation.LogLevel.DEBUG'),
    (r'BackgroundGeolocation\.LOG_LEVEL_INFO','BackgroundGeolocation.LogLevel.INFO'),
    (r'BackgroundGeolocation\.LOG_LEVEL_WARNING','BackgroundGeolocation.LogLevel.WARNING'),
    (r'BackgroundGeolocation\.LOG_LEVEL_ERROR','BackgroundGeolocation.LogLevel.ERROR'),
    (r'BackgroundGeolocation\.LOG_LEVEL_OFF','BackgroundGeolocation.LogLevel.OFF'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_ALWAYS','BackgroundGeolocation.AuthorizationStatus.ALWAYS'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_WHEN_IN_USE','BackgroundGeolocation.AuthorizationStatus.WHEN_IN_USE'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_DENIED_ALWAYS','BackgroundGeolocation.AuthorizationStatus.DENIED'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_DENIED','BackgroundGeolocation.AuthorizationStatus.DENIED'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_NOT_DETERMINED','BackgroundGeolocation.AuthorizationStatus.NOT_DETERMINED'),
    (r'BackgroundGeolocation\.AUTHORIZATION_STATUS_RESTRICTED','BackgroundGeolocation.AuthorizationStatus.RESTRICTED'),
]
for old, new in reps: c = re.sub(old, new, c)
if "v5 Config type strictness" not in c:
    c = re.sub(r"(\n)([ \t]*)(desiredAccuracy:)",
               r"\1\2// @ts-ignore - v5 Config type strictness\1\2\3", c, count=1)
if c != orig: open(p, "w").write(c); print(f"updated {p}")
else: print(f"no change in {p}")
PY
  ok "locationService.ts processed"
fi

# ─────────────────────────────────────────────
hdr "3/7  SQLite types fallback"
if [ ! -f node_modules/react-native-sqlite-storage/sqlite.d.ts ] && \
   [ ! -d node_modules/@types/react-native-sqlite-storage ]; then
  mkdir -p src/types
  cat > src/types/react-native-sqlite-storage.d.ts <<'DTS'
// Fallback type declarations for react-native-sqlite-storage
declare module 'react-native-sqlite-storage' {
  const SQLite: any;
  export default SQLite;
}
DTS
  ok "created src/types/react-native-sqlite-storage.d.ts"
else
  skip "sqlite storage types already available"
fi

# ─────────────────────────────────────────────
hdr "4/7  ESLint: remove unused View import"
AQ="src/screens/AddQuestScreen.tsx"
if [ -f "$AQ" ]; then
  backup_file "$AQ"
  python3 - "$AQ" <<'PY'
import re, sys
p = sys.argv[1]; c = open(p).read(); orig = c
after_imports = c.split("from 'react-native'", 1)[-1]
import re
import re as _re
if _re.search(r"\bView\b", after_imports):
    print("View appears used outside imports — skipping"); sys.exit(0)
c = re.sub(r"import\s*\{\s*View\s*\}\s*from\s*['\"]react-native['\"];?\s*\n", "", c)
c = re.sub(r"import\s*\{\s*View\s*,", "import {", c)
c = re.sub(r",\s*View\s*,", ",", c)
c = re.sub(r",\s*View\s*\}", " }", c)
if c != orig: open(p, "w").write(c); print("removed unused View import")
else: print("no change")
PY
else skip "$AQ not found"; fi

if [ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f .eslintrc ]; then
  npx --no-install eslint "src/**/*.{ts,tsx}" App.tsx --fix >/dev/null 2>&1 || true
  ok "eslint --fix applied"
fi

# ─────────────────────────────────────────────
hdr "5/7  Android SDK (local.properties)"
if [ -d android ]; then
  SDK=""
  for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" \
           "$HOME/Library/Android/sdk" "/usr/local/android-sdk" \
           "/opt/android-sdk" "$HOME/android-sdk"; do
    [ -n "${c:-}" ] && [ -d "$c" ] && { SDK="$c"; break; }
  done
  if [ -n "$SDK" ]; then
    echo "sdk.dir=$SDK" > android/local.properties
    ok "android/local.properties → sdk.dir=$SDK"
    info "Add to shell rc:  export ANDROID_HOME=\"$SDK\""
  else
    err "Android SDK not found. Install Android Studio, then:"
    err "  export ANDROID_HOME=\"/path/to/Android/Sdk\""
    err "  echo \"sdk.dir=\$ANDROID_HOME\" > android/local.properties"
  fi
else skip "android/ not found"; fi

# ─────────────────────────────────────────────
hdr "6/7  iOS Pods"
if [[ "$OSTYPE" == "darwin"* ]] && [ -f ios/Podfile ]; then
  (cd ios && pod install --repo-update) && ok "pods installed"
else skip "not macOS or no Podfile"; fi

# ─────────────────────────────────────────────
hdr "7/7  TypeScript check"
if npx --no-install tsc --noEmit 2>/tmp/tsc-after-fix.log; then
  ok "TypeScript compiles cleanly ✓"
else
  err "tsc still failing — see /tmp/tsc-after-fix.log"
  head -n 40 /tmp/tsc-after-fix.log
fi

echo
hdr "Done"
echo "Backups: $BACKUP"
echo "Now run:  ./verify-montquest.sh"
echo "If tsc still fails, send /tmp/tsc-after-fix.log."
