# MontQuest — راهنمای انتشار نسخهٔ نهایی (Release Guide)

راهنمای گام‌به‌گام خروجی Production برای Android و iOS. چک‌لیست‌های QA و بازبینی‌های الزامی در [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) و تست‌های دستگاهی در [TESTING.md](TESTING.md) هستند — این فایل مسیر اجرا را قدم‌به‌قدم توضیح می‌دهد.

## ۰. آماده‌سازی مشترک (هر دو پلتفرم)

```bash
npm run doctor          # محیط سالم؟
npm test && npx tsc --noEmit && npx eslint src App.tsx index.js __tests__
```

- [ ] کلیدهای لازم فقط در فایل‌های محلی/CI باشند (بخش امنیتی در پایین)
- [ ] `versionCode`/`versionName` در `android/app/build.gradle` و ‏`MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` در Xcode به‌روز شوند
- [ ] QA دستگاهی طبق TESTING.md پاس شده باشد

---

## ۱. Android

### ۱.۱ ساخت Keystore (اگر ندارید)

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore montquest-release.keystore \
  -alias montquest \
  -keyalg RSA -keysize 2048 -validity 10000
```

- فایل keystore را **هرگز در مخزن commit نکنید** (الگوی `*.keystore` در `.gitignore` است؛ `debug.keystore` استثنا شده).
- رمزها را در `~/.gradle/gradle.properties` (خارج از مخزن) نگه دارید:

```properties
MONTQUEST_UPLOAD_STORE_FILE=/absolute/path/montquest-release.keystore
MONTQUEST_UPLOAD_STORE_PASSWORD=********
MONTQUEST_UPLOAD_KEY_ALIAS=montquest
MONTQUEST_UPLOAD_KEY_PASSWORD=********
```

- **اتصال به پروژه:** در `android/app/build.gradle` یک signingConfig مخصوص release بسازید (الان release با debug.keystore امضا می‌شود — این را عوض کنید):

```gradle
signingConfigs {
    debug { /* موجود */ }
    release {
        storeFile file(MONTQUEST_UPLOAD_STORE_FILE)
        storePassword MONTQUEST_UPLOAD_STORE_PASSWORD
        keyAlias MONTQUEST_UPLOAD_KEY_ALIAS
        keyPassword MONTQUEST_UPLOAD_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release   // ← جایگزین signingConfigs.debug
        minifyEnabled enableProguardInReleaseBuilds
        proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
}
```

- **پشتیبان‌گیری:** فایل keystore + رمزها را در جای امن (مدیر رمز/گنجور سازمانی) نگه دارید — بدون آن آپدیت‌های بعدی قابل انتشار نیستند.

### ۱.۲ کلید لایسنس TransistorSoft

- داخل `<application>` فایل `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
  android:name="com.transistorsoft.locationmanager.license"
  android:value="ANDROID_JWT_LICENSE_KEY" />
```

- مقدار را دستی وارد کنید یا برای جلوگیری از commit شدن، از placeholder با تزریق از `local.properties` استفاده کنید (همان الگوی قبلی `manifestPlaceholders`). کلید را commit نکنید.
- بدون این کلید، build debug کار می‌کند ولی release پیام trial/expired می‌دهد.

### ۱.۳ ساخت APK / AAB

```bash
cd android
./gradlew clean
./gradlew assembleRelease     # APK:  android/app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease       # AAB برای Google Play: app/build/outputs/bundle/release/app-release.aab
```

- **تأیید امضا:**
```bash
$ANDROID_HOME/build-tools/<ver>/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```
- **تأیید نبودن کلید تستی/مکان در باینری:**
```bash
# نباید چیزی پیدا کند:
unzip -p app-release.apk AndroidManifest.xml | strings | grep -iE "MISSING_GOOGLE_MAPS|YOUR_.*_KEY|debug"
```
- نصب دستی برای تست نهایی: `adb install -r app-release.apk` — سپس سناریوهای TESTING.md را روی build **release** (بدون لاگ `[MontQuest]` — باگ ۳ قبلاً رفع شده) اجرا کنید.

---

## ۲. iOS

### ۲.۱ کلید لایسنس TransistorSoft

در `ios/MontQuest/Info.plist`:

```xml
<key>TSLocationManagerLicense</key>
<string>IOS_JWT_LICENSE_KEY</string>
```

### ۲.۲ آماده‌سازی بومی

```bash
npm install
cd ios && pod install && cd -    # SDK بومی MapLibre از طریق SPM اضافه می‌شود
```

- [ ] پوشهٔ `ios/MontQuest/Sounds/` (سه WAV) را یک‌بار در Xcode به target **MontQuest** drag کنید (افکت‌های صوتی iOS)
- [ ] Signing & Capabilities: Team درست، Background Modes با **Location updates**، ‏PrivacyInfo.xcprivacy بازبینی‌شده (طبق RELEASE_CHECKLIST.md §2)

### ۲.۳ Archive و انتشار

1. در Xcode: scheme را **Release** و دستگاه هدف **Any iOS Device (arm64)** انتخاب کنید
2. `Product → Archive` (یا خط فرمان: `xcodebuild -workspace ios/MontQuest.xcworkspace -scheme MontQuest -configuration Release -archivePath build/MontQuest.xcarchive archive`)
3. در Organizer: **Distribute App** → App Store Connect (یا Ad Hoc برای تست)
4. اولین اجرای release روی دستگاه: سناریوهای TESTING.md (بدون لاگ console)

---

## ۳. چک‌لیست امنیتی (قبل از انتشار — الزامی)

| # | بررسی | روش |
|---|---|---|
| ۱ | **debug keystore در release امضا نکرده باشد** | خروجی `apksigner verify --print-certs` باید CN keystore شخصی شما باشد، نه `Android Debug` |
| ۲ | **هیچ کلید API/لایسنس در مخزن نباشد** | `git grep -iE "AIza|JWT.*ey|PASSWORD|SECRET"` روی tracked files → فقط نام متغیرها، نه مقدار |
| ۳ | **کلید نقشه وجود ندارد که لو برود** | این پروژه MapLibre است و اصلاً کلید نقشه ندارد: `git grep -iE "MAPS_API_KEY\|google.android.geo"` باید خالی باشد |
| ۴ | **فایل‌های محلی commit نشده باشند** | `git status` تمیز؛ `git check-ignore android/local.properties` → ignore است (به‌همراه `*.bak` و پوشه‌های بکاپ) |
| ۵ | **keystore/رمزها در .gitignore** | الگوی `*.keystore` موجود است؛ keystore release را خارج از پوشهٔ پروژه نگه دارید |
| ۶ | **لاگ مختصات در release نباشد** | `grep -rn "console\." src/ index.js App.tsx` → فقط همان مورد داخل `__DEV__` (useProximityMonitor.ts:89) |
| ۷ | **منابع شبکه فقط OpenFreeMap** | هیچ endpoint دیگری در کد نیست: `git grep -rE "https?://" src/ index.js` → فقط tiles.openfreemap.org و مستندات |
| ۸ | **آسیب‌پذیری‌های runtime** | `npm audit` — ‏۲۱ مورد موجود همگی در زنجیرهٔ dev (eslint/RN CLI) هستند و در باندل اپ نمی‌روند؛ ارتقای major لازم دارد (گزارش شد، انجام نشد) |
| ۹ | **Release build بدون لاگ SDK** | `logLevel: Error` در release (کد موجود) — با نصب APK روی دستگاه، Logcat نباید `[MontQuest] position check` نشان دهد |

---

## ۴. توزیع

- **Google Play:** آپلود `app-release.aab` + Data Safety: «داده‌ای جمع‌آوری نمی‌شود» (کاشی نقشه درخواست شبکه بدون ارسال موقعیت کاربر است)
- **App Store:** از Organizer؛ در App Privacy هم «No Data Collected»
- نسخهٔ بعدی: شماره‌ها را bump کنید و CHANGELOG.md را به‌روز کنید
