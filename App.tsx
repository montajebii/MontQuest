import React from 'react';
import { StatusBar } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import { GameProvider } from './src/state/GameContext';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import NearbyQuestOverlay from './src/components/NearbyQuestOverlay';
import ErrorBoundary from './src/components/ErrorBoundary';

/**
 * Notification tap → open the Map screen (pressAction 'default').
 * Registered at module scope so it also covers a background relaunch.
 * On a cold start the container may not be mounted yet — the navigate
 * call is guarded and simply no-ops then.
 */
const openMapOnNotificationPress = (
  type: EventType,
  pressActionId?: string,
) => {
  if (type === EventType.PRESS && pressActionId === 'default') {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Map');
    }
  }
};

notifee.onForegroundEvent((event) => {
  openMapOnNotificationPress(event.type, event.detail?.pressAction?.id);
});

notifee.onBackgroundEvent(async (event) => {
  openMapOnNotificationPress(event.type, event.detail?.pressAction?.id);
});

const App = () => (
  <GameProvider>
    <StatusBar barStyle="light-content" backgroundColor="#000" />
    {/* Crash guard: legacy DB rows or render errors must never red-screen */}
    <ErrorBoundary>
      <AppNavigator />
      <NearbyQuestOverlay />
    </ErrorBoundary>
  </GameProvider>
);

export default App;
