import BackgroundGeolocation, {
  Geofence,
  ProviderChangeEvent,
  State,
} from 'react-native-background-geolocation';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import { getActiveQuests } from '../db/quests';
import { getSetting } from '../db/settings';
import {
  ACTIVITY_RECOGNITION_INTERVAL_MS,
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_TRACKING_INTERVAL_MINUTES,
  DISTANCE_FILTER_M,
  SETTING_CHECK_INTERVAL_MINUTES,
  SETTING_DEFAULT_RADIUS_METERS,
  SETTING_TRACKING_ENABLED,
  STOP_TIMEOUT_MINUTES,
} from '../utils/constants';

const NEARBY_CHANNEL_ID = 'nearby';

// ── settings accessors ─────────────────────────────────────────────

/** Check interval in minutes (AC-03); defaults to 5. */
export const getCheckIntervalMinutes = async (): Promise<number> => {
  const raw = await getSetting(SETTING_CHECK_INTERVAL_MINUTES);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_TRACKING_INTERVAL_MINUTES;
};

/** Default geofence radius in meters, offered when creating new quests. */
export const getDefaultRadiusMeters = async (): Promise<number> => {
  const raw = await getSetting(SETTING_DEFAULT_RADIUS_METERS);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GEOFENCE_RADIUS_M;
};

/**
 * Tracking On/Off switch — defaults to On (spec §2: on re-open, tracking
 * restarts with the saved settings unless the user disabled it).
 */
export const isTrackingEnabled = async (): Promise<boolean> => {
  const raw = await getSetting(SETTING_TRACKING_ENABLED);
  return raw === null ? true : raw === 'true';
};

// ── plugin lifecycle ───────────────────────────────────────────────

export const configureBackgroundGeolocation = async (): Promise<State> =>
  BackgroundGeolocation.ready({
    // @ts-ignore - v5 Config type strictness
    desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
    distanceFilter: DISTANCE_FILTER_M,
    stopOnTerminate: false,
    startOnBoot: true,
    debug: __DEV__,
    logLevel: __DEV__
      ? BackgroundGeolocation.LogLevel.Verbose
      : BackgroundGeolocation.LogLevel.Error,
    foregroundService: true,
    notification: {
      title: 'MontQuest در حال اجراست',
      text: 'در حال بررسی موقعیت برای کوئست‌های نزدیک',
    },
    geofenceProximityRadius: 500,
    // Fire ENTER immediately when the device already sits inside a geofence
    // (e.g. a quest created at the current location).
    geofenceInitialTriggerEntry: true,
    stopTimeout: STOP_TIMEOUT_MINUTES,
    activityRecognitionInterval: ACTIVITY_RECOGNITION_INTERVAL_MS,
  });

/**
 * Starts tracking only if the user has not disabled it (spec §6:
 * STOPPED → IDLE transition calls this on re-open).
 */
export const startTracking = async (): Promise<boolean> => {
  if (!(await isTrackingEnabled())) {return false;}
  await BackgroundGeolocation.start();
  return true;
};

export const stopTracking = async (): Promise<void> => {
  await BackgroundGeolocation.stop();
};

// ── geofences ──────────────────────────────────────────────────────

/** Re-registers a geofence for every active quest (one per quest). */
export const syncGeofences = async (): Promise<void> => {
  await BackgroundGeolocation.removeGeofences();
  const quests = await getActiveQuests();
  if (quests.length === 0) {return;}
  const geofences: Geofence[] = quests.map((q) => ({
    identifier: `quest_${q.id}`,
    latitude: q.latitude,
    longitude: q.longitude,
    radius: q.radius,
    notifyOnEntry: true,
    notifyOnExit: false,
    notifyOnDwell: false,
    extras: { questId: q.id },
  }));
  await BackgroundGeolocation.addGeofences(geofences);
};

export const removeQuestGeofence = async (questId: number): Promise<void> => {
  try {
    await BackgroundGeolocation.removeGeofence(`quest_${questId}`);
  } catch {}
};

// ── location ───────────────────────────────────────────────────────

/** One-shot position fix for the foreground periodic check and the map picker. */
export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
}> => {
  const location = await BackgroundGeolocation.getCurrentPosition({
    samples: 1,
    timeout: 15,
    desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.Medium,
    persist: false,
    maximumAge: 10_000,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
};

// ── notifications ──────────────────────────────────────────────────

const ensureNearbyChannel = async (): Promise<void> => {
  await notifee.createChannel({
    id: NEARBY_CHANNEL_ID,
    name: 'کوئست‌های نزدیک',
    importance: AndroidImportance.HIGH,
  });
};

/** Local notification on proximity — foreground and background (AC-05). */
export const showNearbyNotification = async (questTitle: string): Promise<void> => {
  await ensureNearbyChannel();
  await notifee.displayNotification({
    title: 'کوئست نزدیک!',
    body: questTitle,
    android: { channelId: NEARBY_CHANNEL_ID, pressAction: { id: 'default' } },
  });
};

// ── permissions ────────────────────────────────────────────────────

/**
 * Runtime `ACCESS_FINE_LOCATION` request via RN PermissionsAndroid —
 * required before MapLibre's UserLocation or a one-shot fix will work
 * on a real device (the BG-geolocation SDK's own request isn't always
 * surfaced the same way).
 */
export const ensureForegroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {return true;}
  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (already) {return true;}
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'مجوز موقعیت',
        message:
          'MontQuest برای نمایش موقعیت شما روی نقشه و اطلاع‌رسانی کوئست‌های نزدیک به مجوز موقعیت دقیق نیاز دارد.',
        buttonPositive: 'اجازه می‌دهم',
        buttonNegative: 'بعداً',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

/** Check-only variant (no dialog) for refresh-on-focus flows. */
export const hasForegroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {return true;}
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  } catch {
    return false;
  }
};

export type AccuracyMode = 'full' | 'reduced' | 'unknown';

/**
 * Android 12+/14: the user may grant "Approximate" only — geofencing and
 * a usable position then need "Precise" (accuracyAuthorization: 0=Full,
 * 1=Reduced per the BG-geolocation types).
 */
export const getLocationAccuracy = async (): Promise<AccuracyMode> => {
  try {
    const provider = await BackgroundGeolocation.getProviderState();
    if (provider.accuracyAuthorization === 1) {return 'reduced';}
    if (provider.accuracyAuthorization === 0) {return 'full';}
    return 'unknown';
  } catch {
    return 'unknown';
  }
};

/** Whether the OS location service (GPS) is switched on at all. */
export const isGpsEnabled = async (): Promise<boolean> => {
  try {
    const provider = await BackgroundGeolocation.getProviderState();
    return !!(provider.enabled && provider.gps);
  } catch {
    return true; // can't tell — don't block the flow
  }
};

export interface PermissionSummary {
  location: 'always' | 'when_in_use' | 'denied' | 'unknown';
  /** Whether the plugin is actively tracking right now ("در حال بررسی"/"متوقف"). */
  trackingEnabled: boolean;
}

/** Read-only permission + tracking status for the Settings screen. */
export const getPermissionSummary = async (): Promise<PermissionSummary> => {
  let location: PermissionSummary['location'] = 'unknown';
  try {
    const provider: ProviderChangeEvent =
      await BackgroundGeolocation.getProviderState();
    if (provider.status === BackgroundGeolocation.AuthorizationStatus.Always) {
      location = 'always';
    } else if (
      provider.status === BackgroundGeolocation.AuthorizationStatus.WhenInUse ||
      provider.status === 2 // legacy ALLOWED mapping
    ) {
      location = 'when_in_use';
    } else {
      location = 'denied';
    }
  } catch {}
  let trackingEnabled = false;
  try {
    trackingEnabled = (await BackgroundGeolocation.getState()).enabled;
  } catch {}
  return { location, trackingEnabled };
};

export const requestBackgroundPermission = async (): Promise<boolean> => {
  try {
    const status = await BackgroundGeolocation.requestPermission();
    return status === BackgroundGeolocation.AuthorizationStatus.Always;
  } catch {
    return false;
  }
};
