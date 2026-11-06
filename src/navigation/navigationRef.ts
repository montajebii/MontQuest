import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './AppNavigator';

/**
 * Imperative navigation handle for code outside React components
 * (e.g. notification tap handlers in App.tsx).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
