# MontQuest — چک‌لیست Release

این چک‌لیست فقط موارد آماده‌سازی انتشار است. رفتار محصول (پاداش، لول، Exit) تغییر نمی‌کند.

## ۱. Android

### ۱.۱ نقشه (MapLibre)
- نقشه **MapLibre + OpenFreeMap** است — **هیچ کلید API لازم نیست و هیچ placeholder/key در build یا مانیفست نیست.**
- ☐ تأیید: `grep -rE "MAPS_API_KEY|google.android.geo|react-native-maps" android/ src/ ios/Podfile` باید خالی باشد

### ۱.۲ لایسنس TransistorSoft
- کتابخانهٔ `react-native-background-geolocation` v5 برای build **Release** به کلید نیاز دارد (Debug بدون لایسنس کار می‌کند).
- داخل `<application>` فایل `android/app/src/main/AndroidManifest.xml` اضافه کنید:
  ```xml
  <meta-data
    android:name="com.transistorsoft.locationmanager.license"
    android:value="ANDROID_JWT_LICENSE_KEY" />
  ```
- کلید را در مخزن commit نکنید؛ در CI از secret تزریق کنید.
- ☐ تأیید: build release بدون پیام trial/expired لایسنس بالا می‌آید.

### ۱.۳ Keystore و امضا
- `android/app/build.gradle` فعلاً release را با `debug.keystore` امضا می‌کند — **قبل از انتشار حتماً keystore اختصاصی بسازید**:
  ```bash
  keytool -genkeypair -v -storetype PKCS12 -keystore montquest-release.keystore -alias montquest -keyalg RSA -keysize 2048 -validity 10000
  ```
- رمزها را در `~/.gradle/gradle.properties` (خارج از مخزن) نگه دارید، نه در `build.gradle`.
- ☐ تأیید: `signingConfig signingConfigs.release` با keystore اختصاصی
- ☐ تأیید: `./gradlew :app:bundleRelease` و بررسی امضا با `apksigner verify`

### ۱.۴ نسخه
- ☐ `versionCode` / `versionName` در `android/app/build.gradle` به‌روز شود (فعلاً 1 / "1.0").
- ☐ `app.json` و iOS هم‌خوان باشند.

## ۲. iOS

- ☐ لایسنس TransistorSoft در `ios/MontQuest/Info.plist`:
  ```xml
  <key>TSLocationManagerLicense</key>
  <string>IOS_JWT_LICENSE_KEY</string>
  ```
- ☐ در Xcode → Signing & Capabilities → **Background Modes** فعال و **Location updates** تیک‌خورده باشد (`UIBackgroundModes = [location]` از قبل در Info.plist هست).
- ☐ Usage descriptions پر و معنادار باشند (`NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`, `NSUserNotificationUsageDescription`).
- ☐ **PrivacyInfo.xcprivacy** بازبینی شود: نوع دادهٔ `NSPrivacyCollectedDataTypeLocation` باید `NSPrivacyCollectedDataTypePurposeAppFunctionality` و `NotLinked` باشد (داده فقط محلی است؛ هیچ ارسال شبکه‌ای وجود ندارد).
- ☐ **افکت‌های صوتی iOS:** پوشهٔ `ios/MontQuest/Sounds/` (سه فایل WAV تولیدشده با `npm run gen:sfx`) را یک‌بار در Xcode به target مونت‌کوئست drag کنید (برای Android خودکار از `res/raw` لود می‌شود).
- ☐ `pod install` بعد از هر تغییر native.
- ☐ نسخه (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`) در project.pbxproj.

## ۳. QA روی دستگاه (قبل از انتشار)

| # | سناریو | انتظار |
|---|---|---|
| AC-01 | ثبت کوئست از FAB → فرم نقشه → ذخیره | کوئست در لیست و روی نقشه (سبز + دایرهٔ شعاع) |
| AC-02 | شبیه‌سازی موقعیت داخل شعاع | رویداد ENTER → دیالوگ + نوتیفیکیشن |
| AC-03 | بازه را ۱ دقیقه کنید | لاگ `[MontQuest] position check` هر دقیقه در Logcat (فقط debug؛ در release لاگ نیست) |
| AC-04 | ورود به ژئوفنس | چشمک لبه‌های صفحه |
| AC-05 | ورود به ژئوفنس در foreground و background | نوتیفیکیشن محلی در هر دو حالت |
| AC-06 | لمس سریع دیالوگ | دکمهٔ تأیید ۲ ثانیه غیرفعال |
| AC-10 | اپ را background کنید (بدون kill) و حرکت کنید | رویداد ژئوفنس + نوتیفیکیشن |
| AC-11 | Exit بزنید | سرویس متوقف؛ هیچ رویدادی تا بازگشت |
| AC-12 | اپ را kill و باز کنید | کوئست‌ها/سکه/لول/تنظیمات حفظ شده |
| AC-13 | مجوز پس‌زمینه را رد کنید | تنظیمات وضعیت «رد شده» + پیام راهنما |
| AC-14 | «فعلاً نه» و ورود مجدد < ۲ دقیقه | دیالوگ دوباره باز نمی‌شود |

نکتهٔ دستگاه واقعی: OEMهای شیائومی/سامسونگ/هواوی ممکن است Foreground Service را بکشند — از تنظیمات اپ، «بهینه‌سازی باتری» را غیرفعال کنید (راهنما در صفحهٔ تنظیمات خود اپ هست).

## ۴. پس از انتشار

- ☐ تست آپدیت روی دستگاه با دادهٔ موجود (مهاجرت اسکیمای SQLite وجود ندارد — نسخه‌بندی DB در `src/db/database.ts` هنگام تغییر اسکیما لازم می‌شود).
- ☐ مانیتور crash (در صورت اتصال سرویس) — در حالت فعلی هیچ داده‌ای به بیرون ارسال نمی‌شود.
