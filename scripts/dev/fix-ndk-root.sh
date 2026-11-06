#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$ROOT"
[ -f package.json ] || { echo "Run from project root"; exit 1; }

GREEN="\033[0;32m"; YEL="\033[0;33m"; CYA="\033[0;36m"; NC="\033[0m"
ok(){ printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
warn(){ printf "${YEL}[WARN]${NC} %s\n" "$1"; }
hdr(){ printf "\n${CYA}── %s ──${NC}\n" "$1"; }

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
# Auto-detect any installed NDK version
NDK_VER=$(ls "$SDK/ndk" 2>/dev/null | tail -n 1 || echo "")
if [ -z "$NDK_VER" ]; then
  echo "ERROR: No NDK found in $SDK/ndk. Please install one via Android Studio SDK Manager."; exit 1
fi
echo "Detected NDK version: $NDK_VER"
echo "SDK path: $SDK"

# ─────────────────────────────────────────────
hdr "1) Clean previous local patch in app/build.gradle"
APP_GRADLE="android/app/build.gradle"
if [ -f "$APP_GRADLE" ]; then
  python3 - "$APP_GRADLE" <<'PY'
import re, sys
p = sys.argv[1]
c = open(p).read()
# Remove any ndkVersion line we previously injected (simple, global in this file)
c2 = re.sub(r'^\s*ndkVersion\s+["\'][^"\']+["\']\s*\n', '', c, flags=re.M)
if c2 != c:
    open(p, 'w').write(c2)
    print(f"Removed local ndkVersion from {p}")
else:
    print("No local ndkVersion to remove")
PY
else warn "$APP_GRADLE not found"; fi

# ─────────────────────────────────────────────
hdr "2) Set ndkVersion globally in android/build.gradle (ext block)"
ROOT_GRADLE="android/build.gradle"
if [ -f "$ROOT_GRADLE" ]; then
  python3 - "$ROOT_GRADLE" "$NDK_VER" <<'PY'
import re, sys
p, ver = sys.argv[1], sys.argv[2]
c = open(p).read()

# 1) If ext { ... } block exists, ensure ndkVersion is inside
m_ext = re.search(r'buildscript\s*\{.*?ext\s*\{(.*?)\}', c, re.S)
if m_ext:
    ext_body = m_ext.group(1)
    if 'ndkVersion' in ext_body:
        # Replace existing value
        new_ext = re.sub(r'ndkVersion\s*=\s*["\'][^"\']+["\']', f'ndkVersion = "{ver}"', ext_body)
        c = c[:m_ext.start(1)] + new_ext + c[m_ext.end(1):]
        print("Replaced ndkVersion in existing ext block")
    else:
        # Insert into existing ext block
        new_ext = ext_body + f'\n        ndkVersion = "{ver}"\n    '
        c = c[:m_ext.start(1)] + new_ext + c[m_ext.end(1):]
        print("Inserted ndkVersion into existing ext block")
else:
    # 2) No ext block: create one inside buildscript
    m_bs = re.search(r'buildscript\s*\{', c)
    if m_bs:
        insert_at = m_bs.end()
        block = f'\n    ext {{\n        ndkVersion = "{ver}"\n    }}\n'
        c = c[:insert_at] + block + c[insert_at:]
        print("Created new ext block with ndkVersion inside buildscript")
    else:
        print("ERROR: Could not find buildscript block in android/build.gradle", file=sys.stderr)
        sys.exit(1)

open(p, 'w').write(c)
PY
  ok "android/build.gradle updated (ndkVersion = $NDK_VER)"
else echo "ERROR: $ROOT_GRADLE not found"; exit 1; fi

# ─────────────────────────────────────────────
hdr "3) Add android.ndkVersion to gradle.properties (belt and suspenders)"
GPROPS="android/gradle.properties"
if [ -f "$GPROPS" ]; then
  if grep -q '^android.ndkVersion=' "$GPROPS"; then
    sed -i.bak "s|^android.ndkVersion=.*|android.ndkVersion=$NDK_VER|" "$GPROPS"
    ok "Updated android.ndkVersion in gradle.properties"
  else
    printf '\n# NDK version used by all modules (RN 0.80+)\nandroid.ndkVersion=%s\n' "$NDK_VER" >> "$GPROPS"
    ok "Appended android.ndkVersion to gradle.properties"
  fi
else warn "$GPROPS not found"; fi

# ─────────────────────────────────────────────
hdr "4) Stop Gradle daemon & clean caches"
( cd android && ./gradlew --stop ) >/dev/null 2>&1 || true
rm -rf android/.gradle android/app/.cxx android/.cxx
ok "Gradle daemon stopped, .cxx and .gradle cleaned"

# ─────────────────────────────────────────────
hdr "5) Retry Android debug build"
if [ -d android ]; then
  ( cd android && ./gradlew :app:assembleDebug --console=plain ) \
    && ok "Android debug build succeeded ✓" \
    || warn "Build failed again — see output above"
else echo "ERROR: android/ not found"; exit 1; fi

echo
hdr "Done"
echo "Next:  ./verify-montquest.sh"
