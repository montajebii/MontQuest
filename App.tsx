import React from 'react';
import { StatusBar } from 'react-native';
import { GameProvider } from './src/state/GameContext';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => (
  <GameProvider>
    <StatusBar barStyle="light-content" backgroundColor="#000" />
    <AppNavigator />
  </GameProvider>
);

export default App;
