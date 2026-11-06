import { NativeModules, Platform } from 'react-native';

/**
 * Sends the app to the background without killing it (spec §2/§7 "Exit").
 *
 * Android: `MainActivity.moveTaskToBack` via a small local native module
 * (`MoveToBackground`). Killing the process would violate the spec, which
 * requires tracking to resume on the next open (STOPPED → IDLE).
 *
 * iOS: the OS offers no API for an app to background itself — the user
 * presses Home. Callers must stop tracking first; on iOS this is a no-op.
 */
export const moveAppToBackground = (): void => {
  if (Platform.OS === 'android') {
    NativeModules.MoveToBackground?.moveTaskToBack();
  }
};
