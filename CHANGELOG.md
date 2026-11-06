# Changelog — MontQuest / منتکوئست

توسعهٔ پروژه در ۹ فاز (هر فاز یک کامیت روی `main`) — از MVP اولیه تا کامل‌ترین وضعیت فعلی.

## فاز ۱ — پیاده‌سازی MVP — `872e76c`
- لایهٔ SQLite (quests/user_profile/quest_history/settings) + تراکنش پاداش اتمیک (۱۰ سکه + ۲۵ XP، لول‌آپ `100×level`)
- BackgroundGeolocation v5: ready/start/stop، همگام‌سازی ژئوفنس، چک دوره‌ای پیش‌زمینه، نوتیفیکیشن محلی، Headless Task
- صفحات: Home (Play/Options/Exit با moveTaskToBack)، Map (TopBar/FAB/تب‌ها)، AddQuest، Quests، Settings
- ماشین حالت نزدیکی: چشمک لبه‌ها، تأخیر ۲ ثانیه‌ای تأیید، cooldown ۲ دقیقه‌ای؛ ماژول native ‏MoveToBackground
- تست‌ها: leveling/geo/reward + smoke رندر اپ

## فاز ۲ — رفع باگ‌های معماری و پاک‌سازی — `dec473a`
- انتقال کل منطق نزدیکی از MapScreen به هوک app-lifetime ‏(`useProximityMonitor` + `NearbyQuestOverlay`) — فعال از هر صفحه و در پس‌زمینه
- حلقهٔ چک دوره‌ای با توقف در پس‌زمینه و ارزیابی مجدد در بازگشت؛ بسته‌شدن race تایمر پس از unmount
- تپ نوتیفیکیشن → Map با navigationRef؛ رویداد `onQuestCompleted`؛ ‏RELEASE_CHECKLIST.md؛ انتقال اسکریپت‌های dev به scripts/dev + gitignore آرتیفکت‌ها

## فاز ۳ — مستندات تست و preflight — `d6854b8`
- TESTING.md: چک‌لیست‌های adb برای AC-01..06 و AC-10..14 (تزریق مختصات، لاگ‌ها)
- `npm run doctor`: preflight محیط (Node، ‏local.properties، لایسنس‌ها)
- README: راهنمای «اولین اجرا از clone تا اولین کوئست»

## فاز ۴ — MapLibre و استایل 8-bit — `6158964`
- حذف کامل Google Maps (react-native-maps، کلید API، placeholderها)؛ نصب `@maplibre/maplibre-react-native@10.4.2` (v11 به React ≥19 نیاز دارد)
- استایل سمت کلاینت `src/assets/mapStyle8bit.json` روی کاشی‌های رایگان OpenFreeMap — اعتبارسنجی‌شده با spec رسمی (پالت ۶ رنگ NES، جاده‌های بلوکی، حذف ساختمان/پارک)
- حلقه‌های شعاع ژئوفنس متر-دقیق (precompute در zoom 0/22 + interpolate نمایی)؛ نشانگر پیکسلی مربعی
- iOS: `$MLRN.post_install` در Podfile (تزریق MapLibre Native از طریق SPM)؛ اندروید بدون تغییر gradle

## فاز ۵ — رفع یافته‌های Audit — `e797e8c`
- F4.1: PixelButton واقعاً disabled می‌شود برای TalkBack (‏role/state) + پراپ label اختیاری
- F1.3: گارد `dialogOpenRef` — دیالوگ باز هرگز بی‌صدا به کوئست دیگر عوض نمی‌شود (+ تست)
- F2.1: نشانگرها GL-رندر شدند — یک ShapeSource + SymbolLayer با آیکون‌های پیکسلی PNG (data URI) + clustering؛ حذف PointAnnotationهای view-محور
- تکمیل دسترسی‌پذیری (تب‌ها، دیالوگ، فرم، ردیف‌ها، PixelMarker)؛ ثبت AUDIT.md

## فاز ۶ — افکت‌های صوتی 8-bit — `84958d5`
- `scripts/gen-sfx.js`: سه صدای chiptune (موج مربعی، ‏22kHz/16bit) — نزدیکی/پاداش/لول‌آپ (‏`npm run gen:sfx`)
- `soundService.ts` با `react-native-sound@0.13`، دروازه‌شده با کلید `sound_enabled` + سوییچ در تنظیمات
- سیم‌کشی: تریگر نزدیکی، بعد از COMMIT پاداش، لول‌آپ (diff لول در refreshProfile — کشف و رفع باگ واقعی پروفایل null)

## فاز ۷ — آواتار پیکسلی — `a268894`
- ProfileScreen با آواتار کاملاً کد-محور (گرید ۸×۸ بدون asset باینری)
- ۵ رده؛ ارتقای قهرمان هر ۵ لول: سرگردان → شمشیرزن → نگهبان → قهرمان → پادشاه
- آمار: سکه، نوار XP، مجموع XP، تعداد کوئست‌های تکمیل‌شده؛ دکمهٔ Profile در Home

## فاز ۸ — خروجی CSV از تاریخچه — `9093a14`
- `src/utils/csv.ts`: ‏RFC 4180 (کاما/نقل‌قول/newline)، timestamp به ISO، ‏BOM برای فارسی در Excel
- دکمهٔ Export CSV در تب کوئست‌ها (فقط با تاریخچهٔ غیرخالی) — اشتراک‌گذاری با `Share` بدون مجوز جدید

## فاز ۹ — ویرایش کوئست — `8472872`
- `updateQuest` در لایهٔ دیتا (عنوان/شرح/مختصات/شعاع) + تست واحد با فیک SQLite
- AddQuestScreen دوحالته (ایجاد/ویرایش) با `route.params.questId`: پیش‌پر شدن از دیتابیس، ‏flyTo دوربین، عنوان و دکمهٔ متغیر
- «ویرایش» در دیالوگ جزئیات کوئست؛ ‏`RootStackParamList.AddQuest: { questId? }`
- پس از ویرایش `syncGeofences` دوباره اجرا می‌شود (شعاع/موقعیت جدید در ژئوفنس اعمال می‌شود)
- مستندات: README + ‏AC-15 در TESTING.md
