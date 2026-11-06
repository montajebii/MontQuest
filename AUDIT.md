# MontQuest — گزارش Audit (فقط بررسی، بدون تغییر کد)

**دامنه:** پایداری دیالوگ نزدیکی در پس‌زمینه، پرفورمنس نشانگرها، حریم خصوصی لاگ‌ها، دسترس‌پذیری.
**روش:** بازبینی ایستای کد (`useProximityMonitor`، `MapScreen`، `NearbyQuestOverlay`، `PixelButton`، `QuestsTab`، `AddQuestScreen`، `index.js`، `jest.setup.js`) + grep سراسری. هیچ فایل کدی تغییر نکرده است.
**قاعدهٔ ارجاع:** `F<n>.<m>` = یافته، `R<n>` = پیشنهاد. شدت‌ها: HIGH/MEDIUM/LOW/INFO.

---

## ۱. پایداری — دیالوگ وقتی کاربر داخل شعاع است و اپ را background می‌کند

ردیابی مسیر در `src/hooks/useProximityMonitor.ts`:

| سناریو | رفتار فعلی | نتیجه |
|---|---|---|
| **A. دیالوگ باز → پس‌زمینه (JS زنده، Android FGS)** | State دیالوگ (`isDialogVisible`, `nearbyQuest`) در حافظه می‌ماند؛ هیچ listener آن را نمی‌بندد. در بازگشت: `AppState → active` → شروع مجدد loop + چک فوری (خطوط 138، 149–155) → هنوز داخل شعاع → `triggerNearby` (خط 69) | ✅ دیالوگ سر جای خودش است. اگر بازگشت **> ۲ دقیقه** از تریگر اولیه گذشته باشد، re-trigger می‌شود و تأخیر ۲ ثانیهٔ تأیید دوباره arm می‌شود؛ اگر < ۲ دقیقه، cooldown مانع re-trigger است ولی دیالوگ اصلاً بسته نشده بود — در هر دو حالت درست. مطابق spec §6 («حفظ وضعیت در حافظه») |
| **B. دیالوگ باز → پس‌زمینه → kill توسط سیستم/OEM → بازگشت** | State حافظه از بین می‌رود؛ mount مجدد → چک فوری → داخل شعاع → `triggerNearby` با `lastPromptRef=0` → دیالوگ دوباره باز می‌شود | ✅ بازیابی صحیح از طریق «ارزیابی مجدد در بازگشت» (همان رفتار موردنظر spec) |
| **C. iOS — wake پس‌زمینه (headless)** | Headless task در `index.js` فقط نوتیفیکیشن می‌دهد؛ در context اصلی UI دیالوگی ست نمی‌شود. در بازگشت کاربر، همان چک فوری دیالوگ را باز می‌کند | ✅ تفکیک درست مسئولیت‌ها |
| **D. «فعلاً نه» → پس‌زمینه → بازگشت < ۲ دقیقه** | Cooldown در حافظه (خط 71–72) مانع re-prompt | ✅ طبق AC-14 (عمدی) |

**یافته‌ها:**

- **F1.1 (LOW/UX):** در سناریوی A، بازگشت پس از > ۲ دقیقه دکمهٔ تأیید را دوباره ۲ ثانیه غیرفعال می‌کند. ایمن است ولی کاربر ممکن است «قفل‌بودن» را باگ بپندارد. → پیشنهاد: نگه دار (جلوگیری از تأیید ناخواستهٔ لحظهٔ بازگشت) و در TESTING.md یک جمله توضیح بده.
- **F1.2 (LOW):** cooldown فقط در حافظه است؛ kill+relaunch آن را صفر می‌کند (سناریوی B). با «cooldown حداقلی» spec سازگار است؛ اگر پس از kill هم لازم شد، باید در `settings` ذخیره شود.
- **F1.3 (MEDIUM — تنها یافتهٔ واقعی رفتاری):** اگر دیالوگ برای کوئست A باز باشد و کاربر در حین باز بودن دیالوگ وارد شعاع کوئست B شود، پس از پایان cooldown تریگر B محتوای همان دیالوگ باز را بی‌هیچ علامتی به B **عوض می‌کند** (`triggerNearby` خط 69–77 بی‌قید `setNearbyQuest` می‌کند). کاربر ممکن است A را در ذهن داشته باشد و B را تأیید کند. → پیشنهاد R1.1: در ابتدای `triggerNearby` گارد `if (dialogOpenRef.current) return;` بگذار (دیالوگ باز = فقط همان کوئست قابل تأیید؛ B پس از بستن دیالوگ در چرخهٔ بعدی می‌آید). یک ref ساده است، بدون تغییر معماری.
- **F1.4 (INFO):** تپ روی نوتیفیکیشن وقتی دیالوگ باز است → `navigationRef.navigate('Map')` — دیالوگ (Modal سطح App) روی نقشه می‌ماند؛ تعارضی ندارد.

**جمع‌بندی ۱:** بازیابی State در هر سه مسیر (زنده/kill/iOS) درست کار می‌کند؛ تنها اصلاح پیشنهادی R1.1 است.

---

## ۲. آیکون‌ها و پرفورمنس (سناریوی ۵۰ کوئست)

- **حلقه‌های شعاع:** در پیاده‌سازی فعلی **یک** `ShapeSource` با FeatureCollection همهٔ کوئست‌های فعال + ۲ `CircleLayer` وجود دارد (`MapScreen.tsx:124–137`) — نه یک Source به‌ازای هر کوئست. رندر GL است و تا صدها فیچر بدون افت محسوس مقیاس می‌شود. ✅ نگرانی «چندین ShapeSource» در کد فعلی موضوعیت ندارد.
- **نشانگرها — نقطهٔ ضعف واقعی (F2.1، MEDIUM):** هر `PointAnnotation` یک **platform view بومی** جدا می‌سازد (خطوط 139–151). با ۵۰ کوئست = ۵۰ view بومی که روی GL رصد و measure می‌شوند — روی دستگاه‌های ضعیف اندرویدی افت فریم هنگام pan/zoom محتمل است (محدودیت شناخته‌شدهٔ annotation های view-محور). PixelMarker هم به‌ازای هر نمونه `elevation: 4` + shadow دارد (`PixelMarker.tsx:15–20`) که هزینه را ×N می‌کند (F2.2، LOW).

**پیشنهادها (به ترتیب اثر):**

- **R2.1 (اصلی):** مهاجرت نشانگرها به **یک** `ShapeSource` (همهٔ کوئست‌ها با property `status`) + ‏`SymbolLayer` + آیکون پیکسلی از طریق کامپوننت `Images` (یا sprite داخل style JSON) — رندر کامل در GPU بدون platform view. تپ از طریق `ShapeSource.onPress` و نمایش `PointAnnotation` **فقط برای کوئست انتخاب‌شده**.
- **R2.2:** برای تراکم بالا، `cluster: true` روی همان Source + لایه‌های cluster (شمارندهٔ پیکسلی).
- **R2.3:** در صورت ماندن روی PointAnnotation: حذف shadow/elevation از PixelMarker و محدودکردن نشانگرها به کوئست‌های فعال + N نزدیک‌ترین.
- **R2.4 (info):** ‏`onSelected={() => undefined}` فعلی (خط ~148) no-op است؛ با رویکرد R2.1 تپ از `onPress` می‌آید و این حذف می‌شود.

---

## ۳. حریم خصوصی — لاگ مکان در Release

- **تنها** فراخوانی console در کل `src/ + App.tsx + index.js` همان لاگ چک دوره‌ای است (`useProximityMonitor.ts:89`) و داخل `if (__DEV__)` (خط 87) است — در Release (`__DEV__ === false`) هرگز اجرا نمی‌شود و مختصات چاپ نمی‌شود. ✅
- `SQLite.DEBUG(__DEV__)` (`database.ts:3`) و `debug: __DEV__` + `logLevel: __DEV__ ? Verbose : Error` برای BackgroundGeolocation (`locationService.ts:56–59`) — در Release لاگ SDK روی Error است و breadcrumb مکانی دوره‌ای ندارد. ✅
- Headless (`index.js`): هیچ console ندارد. ✅
- **F3.1 (INFO):** babel هیچ پلاگین strip-console ندارد — لازم نیست (گاردها کافی‌اند)، ولی اگر «کمربند و بند» خواستی: `babel-plugin-transform-remove-console` فقط برای release profile.
- **F3.2 (INFO):** محتوای نوتیفیکیشن نزدیکی شامل عنوان کوئست است — دادهٔ خودِ کاربر و کاملاً محلی؛ هیچ ارسال شبکه‌ای جز کاشی نقشه (zoom/x/y، بدون مختصات کاربر) وجود ندارد.

**جمع‌بندی ۳:** مطابق الزام پاس است؛ هیچ اقدام الزامی نیست.

---

## ۴. دسترس‌پذیری

اسکن سراسری: فقط **یک** `accessibilityLabel` در کل اپ وجود دارد (FAB). جدول یافته‌ها:

| # | عنصر | محل | مشکل | شدت |
|---|---|---|---|---|
| F4.1 | **دکمهٔ «تأیید» دیالوگ (و همهٔ PixelButtonهای disabled)** | `PixelButton.tsx:12–14` | `disabled` فقط `onPress` را null و opacity را کم می‌کند؛ به `Pressable` پاس نمی‌شود → ‏`accessibilityState.disabled` هرگز ست نمی‌شود و TalkBack دکمهٔ غیرفعال AC-06 را «فعال» اعلام می‌کند — نقض مستقیم معنای AC-06 برای کاربر صفحه‌خوان | **HIGH** |
| F4.2 | همهٔ PixelButtonها | `PixelButton.tsx:12` | `accessibilityRole="button"` صریح ندارد | MEDIUM |
| F4.3 | تب‌های «نقشه/کوئست‌ها» | `MapScreen.tsx:169–180` | نه role، نه `accessibilityState={{selected}}`، نه label | MEDIUM |
| F4.4 | ورودی‌های فرم کوئست | `AddQuestScreen.tsx:135,138,176` | label های متنی مجزا هستند و به `TextInput` متصل نیستند → TalkBack فقط «ویرایش متن» می‌گوید | MEDIUM |
| F4.5 | FAB | `MapScreen.tsx:156–160` | label دارد ✓ (تنها مورد)؛ `accessibilityRole="button"` اضافه شود | LOW |
| F4.6 | ردیف‌های کوئست | `QuestsTab.tsx:98` | متن فرزند خوانده می‌شود ولی role/hint ردیف ندارد | LOW |
| F4.7 | PixelMarker | `PixelMarker.tsx` | عنصر تزئینی است — `importantForAccessibility="no"` ندارد | LOW |
| F4.8 | PointAnnotationها | `MapScreen.tsx:139–151` | annotationهای نقشه برای TalkBack عملاً مات‌اند؛ مسیر دسترس‌پذیر فعلاً فقط لیست تب کوئست‌هاست (در مستندات ذکر شود) | LOW/INFO |
| F4.9 | دیالوگ نزدیکی | `NearbyQuestOverlay.tsx:30–37` | برای تغییر عنوان دیالوگ (سناریوی F1.3) `accessibilityLiveRegion` ندارد | LOW |

**اولویت اصلاح پیشنهادی:** F4.1 (یک خط: پاس‌دادن `disabled` و `accessibilityRole` به Pressable) → F4.3/F4.4 → بقیه.

---

## خلاصهٔ اجرایی

| حوزه | وضعیت | اقدام پیشنهادی |
|---|---|---|
| پایداری دیالوگ پس‌زمینه | ✅ درست (سه مسیر) | R1.1 — گارد «دیالوگ باز، تریگر جدید ممنوع» (یک ref) |
| پرفورمنس ۵۰ کوئست | ⚠️ حلقه‌ها بهینه؛ نشانگرها view-محور | R2.1/R2.2 — SymbolLayer + clustering در فاز بعدی پرفورمنس |
| لاگ مکان در Release | ✅ پاس | اختیاری: transform-remove-console |
| دسترس‌پذیری | ⚠️ یک label در کل اپ | F4.1 فوری (استیت disabled)، سپس role/label ها |
