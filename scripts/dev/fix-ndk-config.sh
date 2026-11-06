#!/usr/bin/env bash
set -u
cd "$(dirname "${BASH_SOURCE[0]}")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
NDK_VER="$(ls "$SDK/ndk" 2>/dev/null | tail -n 1)"

if [ -z "$NDK_VER" ]; then
  echo "ERROR: No NDK found in $SDK/ndk"
  exit 1
fi

echo "Using NDK version: $NDK_VER"

# 1) Remove conflicting entries from gradle.properties
if [ -f android/gradle.properties ]; then
  sed -i.bak '/^android.ndkVersion=/d' android/gradle.properties
  echo "[OK] Removed android.ndkVersion from gradle.properties"
fi

# 2) Set ndkVersion only in android/build.gradle (ext block)
python3 - android/build.gradle "$NDK_VER" <<'PY'
import re, sys
p, ver = sys.argv[1], sys.argv[2]
c = open(p).read()
# Remove any existing ndkVersion line first
c = re.sub(r'^\s*ndkVersion\s*=.*\n', '', c, flags=re.M)
# Insert inside ext block
if re.search(r'ext\s*\{', c):
    c = re.sub(r'(ext\s*\{)', r'\1\n        ndkVersion = "' + ver + '"', c, count=1)
else:
    c = re.sub(r'(buildscript\s*\{)', r'\1\n    ext {\n        ndkVersion = "' + ver + '"\n    }', c, count=1)
open(p, 'w').write(c)
print(f"[OK] Set ndkVersion = \"{ver}\" in {p}")
PY

# 3) Clean caches
rm -rf android/.gradle android/app/.cxx android/.cxx android/build
echo "[OK] Caches cleaned"
