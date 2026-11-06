package com.montquest

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Moves the activity's task to the back (app goes to background) without
 * killing the process — the behavior required for the Exit button, so
 * tracking can be restarted when the user re-opens the app (spec §7).
 */
class MoveToBackgroundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "MoveToBackground"

  @ReactMethod
  fun moveTaskToBack() {
    val activity = currentActivity ?: return
    activity.runOnUiThread { activity.moveTaskToBack(true) }
  }
}
