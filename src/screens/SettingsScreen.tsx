import React, { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PixelButton from '../components/PixelButton';
import { setSetting } from '../db/settings';
import {
  getCheckIntervalMinutes,
  getDefaultRadiusMeters,
  getPermissionSummary,
  isTrackingEnabled,
  PermissionSummary,
  requestBackgroundPermission,
  startTracking,
  stopTracking,
} from '../services/locationService';
import {
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_TRACKING_INTERVAL_MINUTES,
  SETTING_CHECK_INTERVAL_MINUTES,
  SETTING_DEFAULT_RADIUS_METERS,
  SETTING_TRACKING_ENABLED,
} from '../utils/constants';

const PERMISSION_LABELS: Record<PermissionSummary['location'], string> = {
  always: 'مجوز موقعیت: همیشه ✓',
  when_in_use: 'مجوز موقعیت: فقط هنگام استفاده (پس‌زمینه کار نمی‌کند!)',
  denied: 'مجوز موقعیت: رد شده ✗',
  unknown: 'مجوز موقعیت: نامشخص',
};

/**
 * Options screen (spec §4 / Should-have 1-3, 6): check interval, default
 * geofence radius, tracking On/Off + live status, permissions and battery
 * guidance. Values persist to the `settings` table.
 */
const SettingsScreen = () => {
  const [interval, setIntervalValue] = useState(
    String(DEFAULT_TRACKING_INTERVAL_MINUTES),
  );
  const [radius, setRadiusValue] = useState(String(DEFAULT_GEOFENCE_RADIUS_M));
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [summary, setSummary] = useState<PermissionSummary | null>(null);

  const reload = useCallback(async () => {
    setIntervalValue(String(await getCheckIntervalMinutes()));
    setRadiusValue(String(await getDefaultRadiusMeters()));
    setTrackingEnabled(await isTrackingEnabled());
    setSummary(await getPermissionSummary());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {});
    }, [reload]),
  );

  const handleSave = async () => {
    const n = parseInt(interval, 10);
    if (!Number.isFinite(n) || n < 1) {
      Alert.alert('خطا', 'بازهٔ بررسی باید عددی ≥ ۱ دقیقه باشد');
      return;
    }
    const r = parseFloat(radius);
    if (!Number.isFinite(r) || r <= 0) {
      Alert.alert('خطا', 'شعاع پیش‌فرض باید عددی مثبت باشد');
      return;
    }
    await setSetting(SETTING_CHECK_INTERVAL_MINUTES, String(n));
    await setSetting(SETTING_DEFAULT_RADIUS_METERS, String(r));
    Alert.alert(
      'ذخیره شد',
      'بازهٔ بررسی از چرخهٔ بعدی اعمال می‌شود؛ شعاع پیش‌فرض روی کوئست‌های جدید اعمال می‌شود.',
    );
    await reload();
  };

  const handleToggleTracking = async () => {
    const next = !trackingEnabled;
    try {
      if (next) {
        await startTracking();
      } else {
        await stopTracking();
      }
      await setSetting(SETTING_TRACKING_ENABLED, String(next));
      setTrackingEnabled(next);
      setSummary(await getPermissionSummary());
    } catch (e) {
      Alert.alert('خطا', 'تغییر وضعیت ردیابی ناموفق بود.');
    }
  };

  const handleRequestPermission = async () => {
    const ok = await requestBackgroundPermission();
    if (!ok) {
      Alert.alert(
        'مجوز پس‌زمینه لازم است',
        'برای اطلاع‌رسانی کوئست‌ها در پس‌زمینه، مجوز موقعیت «همیشه» را در تنظیمات سیستم فعال کنید.',
        [
          { text: 'باز کردن تنظیمات', onPress: () => Linking.openSettings() },
          { text: 'بستن', style: 'cancel' },
        ],
      );
    }
    setSummary(await getPermissionSummary());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.status}>
        وضعیت ردیابی:{' '}
        {summary?.trackingEnabled ? 'در حال بررسی ✓' : 'متوقف ✗'}
      </Text>
      <Text style={styles.status}>{PERMISSION_LABELS[summary?.location ?? 'unknown']}</Text>

      <Text style={styles.label}>بازهٔ بررسی موقعیت (دقیقه)</Text>
      <TextInput
        style={styles.input}
        value={interval}
        onChangeText={setIntervalValue}
        keyboardType="numeric"
      />

      <Text style={styles.label}>شعاع پیش‌فرض ژئوفنس (متر)</Text>
      <TextInput
        style={styles.input}
        value={radius}
        onChangeText={setRadiusValue}
        keyboardType="numeric"
      />

      <PixelButton title="ذخیرهٔ تنظیمات" onPress={handleSave} />
      <PixelButton
        title={trackingEnabled ? 'ردیابی: روشن (خاموش کن)' : 'ردیابی: خاموش (روشن کن)'}
        onPress={handleToggleTracking}
      />
      <PixelButton title="درخواست مجوز پس‌زمینه" onPress={handleRequestPermission} />

      <Text style={styles.label}>راهنمای باتری و محدودیت‌ها</Text>
      <Text style={styles.help}>
        برخی برندها (شیائومی، سامسونگ، هواوی و…) سرویس‌های پس‌زمینه را متوقف
        می‌کنند. برای عملکرد پایدار: اپ را از «بهینه‌سازی باتری» مستثنا کنید،
        «شروع خودکار (Autostart)» را فعال کنید و نوتیفیکیشن اپ را قفل نکنید.
        در iOS اگر اپ توسط سیستم kill شود، اطلاع‌رسانی پس‌زمینه تضمین‌شده نیست.
      </Text>
      <PixelButton title="باز کردن تنظیمات سیستم" onPress={() => Linking.openSettings()} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16 },
  status: { color: '#0f0', fontFamily: 'monospace', fontSize: 13, marginBottom: 6 },
  label: { color: '#0ff', fontFamily: 'monospace', marginTop: 12 },
  input: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 2,
    color: '#fff',
    fontFamily: 'monospace',
    padding: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  help: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 8,
  },
});

export default SettingsScreen;
