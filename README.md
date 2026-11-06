# MontQuest / منتکوئست

اپلیکیشن موبایل Cross-platform (Android + iOS) برای مدیریت کوئست‌های مکانی با رویکرد گیمیفیکیشن و تم 8-bit، پیاده‌شده با React Native + TypeScript. همهٔ داده‌ها **کاملاً محلی و آفلاین** در SQLite ذخیره می‌شوند؛ بدون بک‌اند، حساب کاربری یا همگام‌سازی ابری.

## پشتهٔ فناوری

| بخش | کتابخانه |
|---|---|
| فریم‌ورک | React Native 0.76 + TypeScript |
| ژئوفنسینگ / ردیابی پس‌زمینه | `react-native-background-geolocation` v5 (TransistorSoft) |
| نقشه | `@maplibre/maplibre-react-native` (متن‌باز، بدون API Key) + کاشی‌های رایگان OpenFreeMap |
| نوتیفیکیشن محلی | `@notifee/react-native` |
| ذخیره‌سازی | `react-native-sqlite-storage` |

## قابلیت‌های پیاده‌شده

**Must-have (بخش ۳ مشخصات):**
- ثبت کوئست (عنوان، شرح کار، موقعیت روی نقشه، شعاع) در یک Modal
- نمایش کوئست‌های فعال و قبلی روی نقشه 8-bit MapLibre (نشانگر مربع پیکسلی سبز/خاکستری + حلقهٔ شعاع ژئوفنس متر-دقیق برای فعال‌ها)
- بررسی دوره‌ای موقعیت در پیش‌زمینه با بازهٔ قابل تنظیم (تایمر JS + `getCurrentPosition`) — هر بررسی در لاگ ثبت می‌شود
- ژئوفنسینگ native برای پس‌زمینه؛ یک ژئوفنس به‌ازای هر کوئست فعال (`syncGeofences`)
- «حالت نزدیکی»: افکت چشمک لبه‌های صفحه + نوتیفیکیشن محلی + دیالوگ تأیید (دکمهٔ تأیید ۲ ثانیه غیرفعال)
- cooldown حداقلی ۲ دقیقه پس از «فعلاً نه» (و پس از هر تریگر)
- پاداش در یک تراکنش SQLite: ۱۰ سکه + ۲۵ XP + لول‌آپ با فرمول `100 × level` + ثبت تاریخچه + تکمیل کوئست
- TopBar سکه/لول/XP، دکمهٔ FAB «+»، دو تب پایین «نقشه» و «کوئست‌ها»
- Home با Play / Options / Exit؛ Exit = `BackgroundGeolocation.stop()` + رفتن به پس‌زمینه (`moveTaskToBack` روی Android — بدون kill)
- بازگشت به اپ → شروع مجدد ردیابی با تنظیمات ذخیره‌شده، مگر کاربر آن را خاموش کرده باشد (ماشین حالت STOPPED → IDLE)
- تب کوئست‌ها: لیست زنده + تاریخچه با عنوان/تاریخ/پاداش؛ جزئیات کوئست با «تکمیل دستی» و «حذف»
- تنظیمات: بازهٔ بررسی، شعاع پیش‌فرض ژئوفنس، کلید روشن/خاموش ردیابی + نمایش «در حال بررسی/متوقف»، وضعیت مجوزها، راهنمای باتری OEM

**Should-have:** همهٔ موارد ۱ تا ۶ (تنظیمات، وضعیت ردیابی، حذف/تکمیل دستی، راهنمای باتری). **Could-have:** افکت‌های صوتی 8-bit (سه صدای chiptune تولیدشده با `scripts/gen-sfx.js`، سوییچ `sound_enabled`) و آواتار پیکسلی (ProfileScreen — قهرمان هر ۵ لول ارتقا می‌یابد: سرگردان تا پادشاه) پیاده شده‌اند؛ خروجی CSV و ویرایش کوئست هنوز خارج از MVP.

## ساختار پروژه

```text
src/
  assets/       mapStyle8bit.json (استایل 8-bit نقشه — Style JSON سمت کلاینت)
  components/   PixelButton، XPBar (TopBar)، EdgeFlashOverlay، NearbyQuestOverlay، PixelMarker
  db/           database.ts (اسکیما)، quests.ts، profile.ts، settings.ts
  hooks/        useProximityMonitor.ts (مانیتور نزدیکی در سطح اپ — all-lifetime)
  navigation/   AppNavigator.tsx (Home / Map / AddQuest-modal / Settings)، navigationRef.ts
  screens/      HomeScreen، MapScreen، AddQuestScreen، QuestsTab، SettingsScreen
  services/     locationService.ts، rewardService.ts (تراکنش پاداش + رویداد onQuestCompleted)
  state/        GameContext.tsx (init + شروع مجدد ردیابی با AppState)
  utils/        constants.ts، leveling.ts، geo.ts (haversine)، appLifecycle.ts
scripts/dev/    اسکریپت‌های تعمیر/تأیید محیط توسعه (fix-*.sh، verify-montquest.sh، init.sh)
scripts/doctor.sh  preflight محیط (npm run doctor)
android/.../com/montquest/   + MoveToBackgroundModule.kt (moveTaskToBack برای Exit)
```

منطق نزدیکی (listener ژئوفنس، چک دوره‌ای، cooldown، دیالوگ تأیید) در هوک `useProximityMonitor` است که یک‌بار در `App.tsx` از طریق `NearbyQuestOverlay` مونت می‌شود — یعنی از **هر صفحه‌ای** و در پس‌زمینه فعال است، نه فقط وقتی نقشه باز است. تایمر چک دوره‌ای هنگام background شدن متوقف و در بازگشت دوباره شروع می‌شود (مسیر پس‌زمینه با ژئوفنس native پوشش داده می‌شود).

## اولین اجرا: از clone تا اولین کوئست

پیش‌نیازها: Node.js ≥ 18، Android Studio/SDK (برای Android)، Xcode + CocoaPods (فقط برای iOS روی macOS).

1. **Clone و نصب:**
   ```bash
   git clone <repo-url> MontQuest && cd MontQuest
   npm install
   ```
2. **فایل محلی اندروید** (`android/local.properties` — هرگز commit نمی‌شود):
   ```bash
   echo "sdk.dir=$ANDROID_HOME" > android/local.properties
   ```
   `sdk.dir` مسیر Android SDK است (مثلاً `~/Android/Sdk` یا `~/Library/Android/sdk`). کلید API برای نقشه لازم نیست — نقشه MapLibre است و کاشی‌ها از OpenFreeMap (رایگان و بدون ثبت‌نام) می‌آیند.
3. **Preflight محیط** (فقط چک — build/تست نمی‌کند):
   ```bash
   npm run doctor
   ```
4. **اجرا:**
   ```bash
   npm run android          # شبیه‌ساز/دستگاه متصل
   # یا برای iOS (روی macOS):
   cd ios && pod install && cd -
   npm run ios
   ```
5. **اولین اجرای اپ:** مجوز Location را روی **«Allow all the time»** و مجوز Notifications را Allow کنید (برای ردیابی پس‌زمینه الزامی است — AC-13 وضعیت مجوزها را در Options نشان می‌دهد).
6. **اولین کوئست:** Play ← دکمهٔ «+» ← عنوان و شرح ← روی نقشه بزنید یا «موقعیت من» ← شعاع ← ذخیره. راهنمای کامل تست: [TESTING.md](TESTING.md).
7. **لایسنس TransistorSoft:** build **debug** بدون لایسنس کار می‌کند؛ برای build Release کلید Android (`com.transistorsoft.locationmanager.license` در مانیفست) و iOS (`TSLocationManagerLicense` در Info.plist) لازم است — مرحله‌به‌مرحله در [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

```bash
npm test          # تست‌های jest
npx tsc --noEmit
npx eslint src App.tsx index.js __tests__
```

## تنظیمات native ضروری

### Android — `android/app/src/main/AndroidManifest.xml`

مجوزهای زیر از قبل تعریف‌اند: `ACCESS_FINE_LOCATION`، `ACCESS_COARSE_LOCATION`، `ACCESS_BACKGROUND_LOCATION`، `FOREGROUND_SERVICE`، `FOREGROUND_SERVICE_LOCATION`، `POST_NOTIFICATIONS`، `RECEIVE_BOOT_COMPLETED`.

1. **نقشه:** MapLibre است — **هیچ کلید API لازم نیست.** کاشی‌های برداری از OpenFreeMap (`https://tiles.openfreemap.org/planet`) و استایل 8-bit از `src/assets/mapStyle8bit.json` سمت کلاینت اعمال می‌شود. برای iOS فقط `cd ios && pod install` (SDK بومی MapLibre به‌صورت خودکار از طریق SPM اضافه می‌شود).
2. **لایسنس TransistorSoft برای Release:** نسخهٔ ۵ کتابخانه برای build Release به کلید نیاز دارد (Debug بدون لایسنس کار می‌کند — ریسک بخش ۹ مشخصات):

```xml
<meta-data
  android:name="com.transistorsoft.locationmanager.license"
  android:value="ANDROID_JWT_LICENSE_KEY" />
```

### iOS — `ios/MontQuest/Info.plist`

از قبل تعریف‌اند: `NSLocationWhenInUseUsageDescription`، `NSLocationAlwaysAndWhenInUseUsageDescription`، `NSLocationAlwaysUsageDescription` (نسخه‌های قدیمی‌تر)، `NSUserNotificationUsageDescription` و `UIBackgroundModes = [location]`. در Xcode، در Signing & Capabilities قابلیت Background Modes با Location updates فعال باشد. برای Release، کلید `TSLocationManagerLicense` را به Info.plist اضافه کنید.

## رفتار پایش، Exit و محدودیت‌ها

- **Exit:** `stop()` کامل سرویس + `moveTaskToBack` (Android). اپ kill نمی‌شود. با بازگشت، اگر کلید `tracking_enabled` روشن باشد (پیش‌فرض)، `start()` دوباره اجرا می‌شود؛ خود Exit این کلید را تغییر نمی‌دهد.
- **پس‌زمینه (Android):** Foreground Service + `stopOnTerminate: false` + `startOnBoot: true`؛ listener ژئوفنس در سطح اپ (`useProximityMonitor`) در پس‌زمینه هم زنده است و نوتیفیکیشن می‌فرستد؛ در حالت kill‌شده، Headless Task ثبت‌شده در `index.js` نوتیفیکیشن را نمایش می‌دهد.
- **تپ نوتیفیکیشن:** با `notifee.onForegroundEvent`/`onBackgroundEvent` (در `App.tsx`) و `navigationRef` کاربر به صفحهٔ نقشه برده می‌شود (`pressAction.id === 'default'`).
- **پس‌زمینه (iOS):** سیستم‌عامل اپ را برای رویداد ژئوفنس wake می‌کند و Headless Task اعلان را می‌فرستد. **Force Kill از App Switcher در iOS تحویل رویداد را تضمین‌نشدنی می‌کند** — محدودیت سیستم‌عامل است و در راهنمای کاربر ذکر شده.
- **محدودیت‌های OEM:** برخی برندها (شیائومی، سامسونگ، هواوی و…) سرویس پس‌زمینه را می‌کشند؛ راهنمای استثناکردن اپ از بهینه‌سازی باتری در صفحهٔ تنظیمات نمایش داده می‌شود.
- **Exit در iOS:** اپ نمی‌تواند خودش به پس‌زمینه برود؛ Exit فقط ردیابی را متوقف می‌کند و کاربر با ژست Home خارج می‌شود (مستندشده در کد).
- **بازهٔ بررسی:** به‌صورت تایمر دوره‌ای در پیش‌زمینه پیاده شده است (`getCurrentPosition` + ارزیابی فاصله در JS، داخل `useProximityMonitor`) و لاگ `[MontQuest] position check` فقط در `__DEV__` می‌دهد (AC-03). تایمر هنگام background شدن متوقف می‌شود؛ در پس‌زمینه تشخیص نزدیکی بر عهدهٔ ژئوفنس native است.
- **دقت ژئوفنس:** `distanceFilter: 75` و `stopTimeout: 5` برای باتری (بخش ۷). طبق مستندات SDK، شعاع زیر ~۲۰۰ متر در عمل کم‌اتکاتر است؛ مقدار پیش‌فرض ۱۰۰ طبق مشخصات حفظ شده و قابل تنظیم است.
- **انحراف مستند از مشخصات:** فیلد `setNotificationResponsiveness` در API عمومی v5 این SDK برای React Native وجود ندارد (فقط native Android)؛ بنابراین قابل تنظیم نیست.
- `geofenceInitialTriggerEntry: true` — اگر کاربر هنگام ثبت کوئست داخل شعاع باشد، رویداد ورود فوراً صادر می‌شود.

## حریم خصوصی

هیچ دادهٔ مکانی به بیرون ارسال نمی‌شود؛ هیچ endpoint، حساب یا همگام‌سازی ابری پیکربندی نشده است. (نمایش کاشی‌های نقشه از OpenFreeMap دریافت می‌شود — درخواست tile شامل zoom/x/y است و موقعیت کاربر را به سرور نمی‌فرستد؛ نقشهٔ آفلاین در MVP پشتیبانی نمی‌شود.)

## مدل داده (SQLite — `montquest.db`)

- `quests(id, title, task, latitude, longitude, radius, status, created_at, completed_at)` — status: `active`/`completed`
- `user_profile(id=1, coins, level, current_xp, total_xp)`
- `quest_history(id, quest_id → quests.id, completed_at, coins_awarded, xp_awarded)`
- `settings(key, value)` — کلیدها: `check_interval_minutes`، `default_radius_meters`، `tracking_enabled`، `sound_enabled`

**ماشین حالت نزدیکی (بخش ۶):** `IDLE` → (ورود ژئوفنس یا چک دوره‌ای) → `NEARBY_PROMPT` (فلش + نوتیفیکیشن + دیالوگ) → تأیید → پاداش → `IDLE`؛ «فعلاً نه» → cooldown ۲ دقیقه → `IDLE`؛ Exit → `STOPPED`؛ بازگشت + ردیابی فعال → `IDLE`.

## تصمیم‌های پیاده‌سازی

| تصمیم | انتخاب | توضیح |
|---|---|---|
| پاداش تکمیل دستی | همان ۱۰ سکه + ۲۵ XP | تأیید کاربر؛ همان تراکنش `completeQuestAndReward` برای سازگاری تاریخچه/اقتصاد |
| معنای Exit | توقف سرویس + `moveTaskToBack` (بدون kill) | الزام بخش ۲/۷؛ بازگشت → شروع مجدد با تنظیمات |
| حذف کوئست | فقط برای کوئست‌های فعال (قبل از تکمیل) | مطابق Should-have ۴ |
| شعاع جدید | فقط روی کوئست‌های جدید اعمال می‌شود | شعاع کوئست‌های ثبت‌شده در DB آنهاست |

## گزارش تست — معیارهای پذیرش (بخش ۸)

تأییدشده با تست واحد/استاتیک در این محیط (بدون شبیه‌ساز/دستگاه):

| AC | وضعیت در این محیط | شرح |
|---|---|---|
| AC-07 | ✅ Pass (تست واحد) | `__tests__/rewardService.test.ts` — تراکنش پاداش: UPDATE پروفایل `[15,2,15,115]`، INSERT تاریخچه، COMMIT |
| AC-08 | ✅ Pass (تست واحد) | `__tests__/leveling.test.ts` — آستانهٔ `100×level`، انتقال باقیمانده، جهش چندلولی |
| AC-09 | ✅ Pass (تست واحد) | INSERT `quest_history` در تراکنش + کوئری تاریخچه با JOIN عنوان در تب تاریخچه |
| AC-01..06, AC-10..14 | 🔲 نیازمند دستگاه/شبیه‌ساز | مراحل تست هر یک در زیر |

راهنمای تست روی دستگاه (طبق روش تست بخش ۸):
- **AC-01/AC-02:** ثبت کوئست با لمس نقشه؛ ورود به شعاع (سفارشی‌سازی موقعیت در emulator) → رویداد `ENTER`.
- **AC-03:** تغییر بازه به ۱ دقیقه در تنظیمات → مشاهدهٔ لاگ `[MontQuest] position check` در Logcat/کنسول.
- **AC-04/AC-05:** ورود به ژئوفنس → افکت لبه‌ها + نوتیفیکیشن در foreground و background.
- **AC-06:** لمس سریع دیالوگ → دکمهٔ تأیید ۲ ثانیه غیرفعال.
- **AC-10:** background کردن اپ (بدون kill) و حرکت در شبیه‌ساز → رویداد ژئوفنس.
- **AC-11:** زدن Exit → عدم دریافت رویداد تا بازگشت (کد ردیابی خاموش)؛ بازگشت → شروع مجدد.
- **AC-12:** kill و بازکردن اپ → کوئست‌ها/سکه/لول/تنظیمات حفظ‌شده (SQLite).
- **AC-13:** ردکردن مجوز پس‌زمینه → نمایش وضعیت «رد شده» و پیام راهنما در تنظیمات.
- **AC-14:** «فعلاً نه» → ورود مجدد به شعاع در کمتر از ۲ دقیقه → دیالوگ دوباره باز نمی‌شود.

`npx tsc --noEmit` و `npx eslint` بدون خطا هستند؛ `npm test` شامل ۴ suite و ۱۲ تست پاس است (smoke رندر App + لولینگ + haversine + تراکنش پاداش).

## خارج از محدودهٔ MVP

ویرایش کوئست پس از ثبت، افکت‌های صوتی، آواتار پیکسلی و خروجی CSV — طبق بخش ۹ مشخصات پیاده نشده‌اند.
