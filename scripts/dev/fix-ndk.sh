#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
[ -f package.json ] || { echo "Run from project root"; exit 1; }

GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok(){ printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
warn(){ printf "${YEL}[WARN]${NC} %s\n" "$1"; }
err(){ printf "${RED}[ERR]${NC}  %s\n" "$1"; }
hdr(){ printf "\n${CYA}── %s ──${NC}\n" "$1"; }

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
NDK_VER="26.1.10909125"
NDK_DIR="$SDK/ndk/$NDK_VER"

hdr "0) Environment"
echo "SDK = $SDK"
[ -d "$SDK" ] || { err "SDK dir not found: $SDK"; exit 1; }

# ─────────────────────────────────────────────
hdr "1) Check if NDK $NDK_VER is already installed"
if [ -f "$NDK_DIR/source.properties" ]; then
  ok "NDK already present at $NDK_DIR"
else
  warn "NDK $NDK_VER not found — will try sdkmanager --no_https"
fi

# ─────────────────────────────────────────────
if [ ! -f "$NDK_DIR/source.properties" ]; then
  hdr "2) Try sdkmanager with --no_https"
  SDKMGR=""
  for c in "$(command -v sdkmanager 2>/dev/null || true)" \
           "$SDK/cmdline-tools/latest/bin/sdkmanager" \
           "$SDK/cmdline-tools/bin/sdkmanager" \
           "$SDK/tools/bin/sdkmanager"; do
    [ -n "${c:-}" ] && [ -x "$c" ] && { SDKMGR="$c"; break; }
  done
  if [ -n "$SDKMGR" ]; then
    echo "Using: $SDKMGR"
    if yes | "$SDKMGR" --sdk_root="$SDK" --no_https "ndk;$NDK_VER" >/tmp/ndk-sdk.log 2>&1; then
      ok "NDK installed via sdkmanager"
    else
      warn "sdkmanager --no_https failed — see /tmp/ndk-sdk.log"
      tail -n 5 /tmp/ndk-sdk.log
    fi
  else
    warn "sdkmanager not found in PATH or common locations"
  fi
fi

# ─────────────────────────────────────────────
if [ ! -f "$NDK_DIR/source.properties" ]; then
  hdr "3) Manual download: android-ndk-r26b-linux.zip (~669 MB)"
  URL="https://dl.google.com/android/repository/android-ndk-r26b-linux.zip"
  TMP="$(mktemp -d)"
  echo "URL: $URL"
  echo "Downloading to $TMP/ndk.zip (may take a few minutes)…"
  if command -v curl >/dev/null 2>&1; then
    curl -L --fail --retry 3 -o "$TMP/ndk.zip" "$URL" || DOWNLOAD_FAIL=1
  else
    wget -O "$TMP/ndk.zip" "$URL" || DOWNLOAD_FAIL=1
  fi
  if [ "${DOWNLOAD_FAIL:-0}" != "1" ] && [ -s "$TMP/ndk.zip" ]; then
    mkdir -p "$SDK/ndk"
    echo "Extracting…"
    unzip -q "$TMP/ndk.zip" -d "$TMP"
    # zip extracts to android-ndk-r26b
    if [ -d "$TMP/android-ndk-r26b" ]; then
      rm -rf "$NDK_DIR"
      mv "$TMP/android-ndk-r26b" "$NDK_DIR"
      ok "NDK extracted to $NDK_DIR"
    else
      err "Unexpected zip layout — inspect $TMP"
    fi
  else
    warn "Manual download failed (network/proxy?)"
  fi
  rm -rf "$TMP"
fi

# ─────────────────────────────────────────────
if [ -f "$NDK_DIR/source.properties" ]; then
  hdr "4) NDK installation verified"
  ok "source.properties present"
else
  hdr "4) Fallback: override ndkVersion to an installed NDK"
  INSTALLED="$(ls "$SDK/ndk" 2>/dev/null | head -n 1 || true)"
  if [ -n "$INSTALLED" ]; then
    warn "Using installed NDK version: $INSTALLED"
    python3 - "$INSTALLED" <<'PY'
import re, sys
ver = sys.argv[1]
p = 'android/app/build.gradle'
c = open(p).read()
if re.search(r'ndkVersion\s+["\']', c):
    c = re.sub(r'ndkVersion\s+["\'][^"\']+["\']', f'ndkVersion "{ver}"', c)
else:
    c = re.sub(r'(android\s*\{)', r'\1\n    ndkVersion "' + ver + '"', c, count=1)
open(p, 'w').write(c)
print(f"ndkVersion set to {ver} in {p}")
PY
    ok "android/app/build.gradle patched"
  else
    err "No NDK installed at $SDK/ndk"
    err "Install Android Studio → SDK Manager → SDK Tools → NDK (Side by side) → $NDK_VER"
    exit 1
  fi
fi

# ─────────────────────────────────────────────
hdr "5) Gradle debug build"
if [ -d android ]; then
  ( cd android && ./gradlew :app:assembleDebug --console=plain ) \
    && ok "Android debug build succeeded ✓" \
    || { err "Build failed — see output above"; exit 1; }
else
  err "android/ not found"
fi

echo
hdr "Done"
echo "Next:  ./verify-montquest.sh"
