#!/usr/bin/env bash
# MontQuest preflight (npm run doctor) — environment checks ONLY.
# Does NOT build, install or test. Exit code 1 = a hard requirement missing;
# warnings (map key, licenses) never fail the run.

PASS=0; FAIL=0; WARN=0
GREEN="\033[0;32m"; RED="\033[0;31m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok()   { PASS=$((PASS+1)); printf "${GREEN}[PASS]${NC} %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "${RED}[FAIL]${NC} %s\n" "$1"; }
warn() { WARN=$((WARN+1)); printf "${YEL}[WARN]${NC} %s\n" "$1"; }

# ── 1) Node >= 18 ─────────────────────────────────────────────────
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$NODE_MAJOR" -ge 18 ]; then
    ok "Node $(node --version) (>= 18)"
  else
    bad "Node $(node --version) is too old — MontQuest needs >= 18"
  fi
else
  bad "node not found in PATH — install Node.js 18+"
fi

# ── 2) android/local.properties with sdk.dir ──────────────────────
LP="android/local.properties"
if [ -f "$LP" ]; then
  SDK_DIR=$(grep -E '^sdk\.dir=' "$LP" | head -1 | cut -d= -f2-)
  if [ -n "$SDK_DIR" ]; then
    if [ -d "$SDK_DIR" ]; then
      ok "android/local.properties → sdk.dir=$SDK_DIR"
    else
      bad "sdk.dir points to a missing directory: $SDK_DIR"
    fi
  else
    bad "android/local.properties exists but has no sdk.dir= line"
  fi
else
  bad "android/local.properties missing — create it:  echo \"sdk.dir=\$ANDROID_HOME\" > android/local.properties"
fi

# ── 3) TransistorSoft license keys (soft: release builds only) ────
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && grep -q "com.transistorsoft.locationmanager.license" "$MANIFEST"; then
  ok "Android TransistorSoft license key present"
else
  warn "Android TransistorSoft license key NOT in AndroidManifest.xml — needed only for RELEASE builds (debug is free)"
fi
PLIST="ios/MontQuest/Info.plist"
if [ -f "$PLIST" ] && grep -q "TSLocationManagerLicense" "$PLIST"; then
  ok "iOS TransistorSoft license key present"
else
  warn "iOS TSLocationManagerLicense NOT in Info.plist — needed only for RELEASE builds (debug is free)"
fi

printf "\n${CYA}doctor summary: ${PASS} pass, ${WARN} warning(s), ${FAIL} failure(s)${NC}\n"
[ "$FAIL" -eq 0 ]
