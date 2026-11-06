#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
[ -f package.json ] || { echo "Run from project root"; exit 1; }

GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok(){ printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
warn(){ printf "${YEL}[WARN]${NC} %s\n" "$1"; }
err(){ printf "${RED}[ERR]${NC}  %s\n" "$1"; }
hdr(){ printf "\n${CYA}── %s ──${NC}\n" "$1"; }
BK=".fix-backup/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

# ─── 1) Fix enum casing in locationService.ts ───
hdr "1/2  Fix enum casing (PascalCase)"
SVC="src/services/locationService.ts"
if [ -f "$SVC" ]; then
  cp "$SVC" "$BK/locationService.ts"
  python3 - "$SVC" <<'PY'
import re, sys
p = sys.argv[1]; c = open(p).read(); orig = c
pairs = [
    # LogLevel
    (r'BackgroundGeolocation\.LogLevel\.VERBOSE',   'BackgroundGeolocation.LogLevel.Verbose'),
    (r'BackgroundGeolocation\.LogLevel\.DEBUG',     'BackgroundGeolocation.LogLevel.Debug'),
    (r'BackgroundGeolocation\.LogLevel\.INFO',      'BackgroundGeolocation.LogLevel.Info'),
    (r'BackgroundGeolocation\.LogLevel\.WARNING',   'BackgroundGeolocation.LogLevel.Warning'),
    (r'BackgroundGeolocation\.LogLevel\.ERROR',     'BackgroundGeolocation.LogLevel.Error'),
    (r'BackgroundGeolocation\.LogLevel\.OFF',       'BackgroundGeolocation.LogLevel.Off'),
    # AuthorizationStatus
    (r'BackgroundGeolocation\.AuthorizationStatus\.ALWAYS',            'BackgroundGeolocation.AuthorizationStatus.Always'),
    (r'BackgroundGeolocation\.AuthorizationStatus\.WHEN_IN_USE',       'BackgroundGeolocation.AuthorizationStatus.WhenInUse'),
    (r'BackgroundGeolocation\.AuthorizationStatus\.DENIED_ALWAYS',     'BackgroundGeolocation.AuthorizationStatus.DeniedAlways'),
    (r'BackgroundGeolocation\.AuthorizationStatus\.DENIED',            'BackgroundGeolocation.AuthorizationStatus.Denied'),
    (r'BackgroundGeolocation\.AuthorizationStatus\.NOT_DETERMINED',    'BackgroundGeolocation.AuthorizationStatus.NotDetermined'),
    (r'BackgroundGeolocation\.AuthorizationStatus\.RESTRICTED',        'BackgroundGeolocation.AuthorizationStatus.Restricted'),
    # DesiredAccuracy (in case still SCREAMING_CASE)
    (r'BackgroundGeolocation\.DesiredAccuracy\.HIGH',        'BackgroundGeolocation.DesiredAccuracy.High'),
    (r'BackgroundGeolocation\.DesiredAccuracy\.MEDIUM',      'BackgroundGeolocation.DesiredAccuracy.Medium'),
    (r'BackgroundGeolocation\.DesiredAccuracy\.LOW',         'BackgroundGeolocation.DesiredAccuracy.Low'),
    (r'BackgroundGeolocation\.DesiredAccuracy\.NAVIGATION',  'BackgroundGeolocation.DesiredAccuracy.Navigation'),
    (r'BackgroundGeolocation\.DesiredAccuracy\.BEST',        'BackgroundGeolocation.DesiredAccuracy.High'),
]
for old, new in pairs: c = re.sub(old, new, c)
if c != orig: open(p, 'w').write(c); print("enum casing fixed")
else: print("no changes needed")
PY
  ok "locationService.ts processed"
else err "$SVC not found"; fi

# ─── 2) Install Android NDK 26.1.10909125 + run tsc ───
hdr "2/2  Install NDK + TypeScript check"
set +u
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
set -u

if [ -d "$SDK" ]; then
  NDK_VER="26.1.10909125"
  NDK_DIR="$SDK/ndk/$NDK_VER"
  if [ -d "$NDK_DIR" ]; then
    ok "NDK already installed at $NDK_DIR"
  else
    echo "Installing NDK $NDK_VER (may take a few minutes)…"
    # Try sdkmanager first
    SDKMGR=""
    for cand in "$SDK/cmdline-tools/latest/bin/sdkmanager" \
                "$SDK/cmdline-tools/bin/sdkmanager" \
                "$SDK/tools/bin/sdkmanager"; do
      [ -x "$cand" ] && { SDKMGR="$cand"; break; }
    done
    if [ -n "$SDKMGR" ]; then
      yes | "$SDKMGR" --sdk_root="$SDK" "ndk;$NDK_VER" >/tmp/ndk-install.log 2>&1 \
        && ok "NDK $NDK_VER installed" \
        || { err "sdkmanager failed — see /tmp/ndk-install.log"; tail -n 10 /tmp/ndk-install.log; }
    else
      err "sdkmanager not found. Install manually:"
      err "  Android Studio → SDK Manager → SDK Tools → NDK (Side by side) → $NDK_VER"
      err "  OR: install cmdline-tools, then: yes | sdkmanager \"ndk;$NDK_VER\""
    fi
  fi
else
  err "SDK dir not found: $SDK"
fi

if npx --no-install tsc --noEmit 2>/tmp/tsc-final.log; then
  ok "TypeScript clean ✓"
else
  err "tsc failing — see /tmp/tsc-final.log"; head -n 20 /tmp/tsc-final.log
fi

echo
hdr "Done"
echo "Backups: $BK"
echo "Next:  ./verify-montquest.sh"
