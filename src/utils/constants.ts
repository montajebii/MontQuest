// ── Settings keys (SQLite `settings` table — spec §5) ─────────────
export const SETTING_CHECK_INTERVAL_MINUTES = 'check_interval_minutes';
export const SETTING_DEFAULT_RADIUS_METERS = 'default_radius_meters';
export const SETTING_TRACKING_ENABLED = 'tracking_enabled';

// ── Game rules (spec §2) ──────────────────────────────────────────
export const XP_PER_QUEST = 25;
export const COINS_PER_QUEST = 10;
export const MIN_CONFIRM_DELAY_MS = 2000; // AC-06: confirm button delay
export const DEFAULT_COOLDOWN_MINUTES = 2; // AC-14: "Not now" cooldown

// ── Defaults ──────────────────────────────────────────────────────
export const DEFAULT_TRACKING_INTERVAL_MINUTES = 5;
export const DEFAULT_GEOFENCE_RADIUS_M = 100;

// ── Battery tuning (spec §7) ──────────────────────────────────────
export const DISTANCE_FILTER_M = 75; // spec suggests 50–100 m
export const STOP_TIMEOUT_MINUTES = 5; // GPS shutoff while stationary
export const ACTIVITY_RECOGNITION_INTERVAL_MS = 10000;

// ── Fallback map center when no location fix is available ─────────
export const DEFAULT_LATITUDE = 35.6892;
export const DEFAULT_LONGITUDE = 51.389;
