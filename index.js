/**
 * @format
 */

import { AppRegistry } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// AC-10 (iOS path): when the OS wakes a terminated app for a geofence
// event, the JS context restarts here without any UI. Show the local
// notification directly. On Android the foreground service usually keeps
// the main JS context alive, so this is a fallback for the killed case.
const backgroundGeolocationHeadlessTask = async (event) => {
  try {
    if (event.name === 'geofence' && event.params?.action === 'ENTER') {
      await notifee.createChannel({ id: 'nearby', name: 'کوئست‌های نزدیک' });
      await notifee.displayNotification({
        title: 'کوئست نزدیک!',
        body: 'به یک کوئست نزدیک شده‌اید — اپ را باز کنید',
        android: { channelId: 'nearby', pressAction: { id: 'default' } },
      });
    }
  } catch (e) {}
};

BackgroundGeolocation.registerHeadlessTask(backgroundGeolocationHeadlessTask);

AppRegistry.registerComponent(appName, () => App);
