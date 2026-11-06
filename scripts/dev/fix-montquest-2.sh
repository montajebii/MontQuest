#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
[ -f package.json ] || { echo "Run from project root"; exit 1; }

GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok(){ printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
skip(){ printf "${YEL}[SKIP]${NC} %s\n" "$1"; }
err(){ printf "${RED}[ERR]${NC}  %s\n" "$1"; }
hdr(){ printf "\n${CYA}── %s ──${NC}\n" "$1"; }
BK=".fix-backup/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

# ─── 1) اصلاح fix-montquest.sh: پچ ANDROID_HOME + View ───
hdr "1/4  Patching fix-montquest.sh"
if [ -f fix-montquest.sh ]; then
  cp fix-montquest.sh "$BK/fix-montquest.sh"
  python3 - <<'PY'
import re
p = 'fix-montquest.sh'
c = open(p).read()
# Fix ANDROID_HOME unbound in the SDK detection loop
c = c.replace(
  'for c in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Android/Sdk"',
  'for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk"'
)
# Strengthen View detection: only standalone \bView\b
c = c.replace(
  'if "View" in after_imports:',
  'import re as _re\nif _re.search(r"\\bView\\b", after_imports):'
)
# Ensure `import re` is available
if 'import re as _re' in c and 'import re\n' not in c.split('import re as _re')[0][-200:]:
    c = c.replace('import re as _re', 'import re\nimport re as _re', 1)
open(p, 'w').write(c)
print("fix-montquest.sh patched")
PY
  ok "fix-montquest.sh patched (ANDROID_HOME + View regex)"
else skip "fix-montquest.sh not found"; fi

# ─── 2) حذف View بی‌استفاده از AddQuestScreen (با منطق دقیق) ───
hdr "2/4  Remove unused View import"
AQ="src/screens/AddQuestScreen.tsx"
if [ -f "$AQ" ]; then
  cp "$AQ" "$BK/AddQuestScreen.tsx"
  python3 - "$AQ" <<'PY'
import re, sys
p = sys.argv[1]
c = open(p).read()
m = re.search(r"import\s*\{([^}]*)\}\s*from\s*['\"]react-native['\"];?", c)
if not m:
    print("no react-native import"); sys.exit(0)
items = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'View' not in items:
    print("View not in react-native import — nothing to do"); sys.exit(0)
body = c[:m.start()] + c[m.end():]
if re.search(r'\bView\b', body):
    print("View is genuinely used in file body — leaving alone"); sys.exit(0)
new_items = [x for x in items if x != 'View']
if not new_items:
    c = c[:m.start()] + c[m.end():]
else:
    c = c[:m.start()] + "import { " + ", ".join(new_items) + " } from 'react-native';" + c[m.end():]
open(p, 'w').write(c)
print("removed unused View import")
PY
  ok "AddQuestScreen.tsx processed"
else skip "$AQ not found"; fi

# ─── 3) پچ verify-montquest.sh برای پذیرش constants.ts ───
hdr "3/4  Patch verify-montquest.sh (accept constants.ts)"
V="verify-montquest.sh"
if [ -f "$V" ]; then
  cp "$V" "$BK/verify-montquest.sh"
  python3 - "$V" <<'PY'
import sys
p = sys.argv[1]
c = open(p).read()
# Rewards: constants.ts
c = c.replace(
  'check_contains "$REWARD" "25" "reward: +25 XP present in rewardService"',
  'check_contains "src/utils/constants.ts" "XP_PER_QUEST.*=.*25" "reward: XP_PER_QUEST = 25"'
).replace(
  'check_contains "$REWARD" "10" "reward: +10 coins present in rewardService"',
  'check_contains "src/utils/constants.ts" "COINS_PER_QUEST.*=.*10" "reward: COINS_PER_QUEST = 10"'
)
# 2-second confirm cooldown: constants.ts OR MapScreen
old = 'check_contains "src/screens/MapScreen.tsx"       "2000"                         "2-second confirm cooldown present"'
new = '''if grep -qE "MIN_CONFIRM_DELAY_MS.*=.*2000|2000" src/utils/constants.ts src/screens/MapScreen.tsx 2>/dev/null; then
  ok "2-second confirm cooldown present"
else
  bad "2-second confirm cooldown not found"
fi'''
c = c.replace(old, new)
open(p, 'w').write(c)
print("verify-montquest.sh patched")
PY
  ok "verify-montquest.sh patched"
else skip "$V not found"; fi

# ─── 4) اجرای tsc و Android SDK ───
hdr "4/4  TypeScript + Android SDK"
# SDK detection with set +u to avoid unbound
set +u
SDK=""
for cand in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" \
            "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" \
            "/usr/local/android-sdk" "/opt/android-sdk" "$HOME/android-sdk"; do
  [ -n "$cand" ] && [ -d "$cand" ] && { SDK="$cand"; break; }
done
set -u

if [ -n "$SDK" ] && [ -d android ]; then
  echo "sdk.dir=$SDK" > android/local.properties
  ok "android/local.properties → sdk.dir=$SDK"
else
  err "Android SDK not found (install Android Studio or set ANDROID_HOME)."
  err "  export ANDROID_HOME=\"/path/to/Android/Sdk\""
  err "  echo \"sdk.dir=\$ANDROID_HOME\" > android/local.properties"
fi

if npx --no-install tsc --noEmit 2>/tmp/tsc-fixed.log; then
  ok "TypeScript clean ✓"
else
  err "tsc still failing — see /tmp/tsc-fixed.log"
  head -n 30 /tmp/tsc-fixed.log
fi

echo
hdr "Done"
echo "Backups: $BK"
echo "Next:  ./verify-montquest.sh"
