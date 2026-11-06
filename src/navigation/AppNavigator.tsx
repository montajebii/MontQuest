import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import AddQuestScreen from '../screens/AddQuestScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { navigationRef } from './navigationRef';

export type RootStackParamList = {
  Home: undefined;
  Map: undefined;
  /** No params = create mode; questId = edit mode (prefills from DB). */
  AddQuest: { questId?: number } | undefined;
  Profile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => (
  <NavigationContainer ref={navigationRef}>
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#0ff' }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      {/* Play screen: TopBar lives inside (XPBar), so the stack header is off. */}
      <Stack.Screen name="Map" component={MapScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="AddQuest"
        component={AddQuestScreen}
        options={{
          title: 'افزودن کوئست',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'تنظیمات' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'پروفایل' }} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
