import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PixelButton from '../components/PixelButton';
import XPBar from '../components/XPBar';
import { moveAppToBackground } from '../utils/appLifecycle';
import { stopTracking } from '../services/locationService';

/**
 * Home (spec §4): Play / Options / Exit.
 * Exit = stop tracking completely + send the app to the background
 * (spec §7). Tracking resumes on the next open unless disabled in Options
 * (GameContext handles the STOPPED → IDLE transition).
 */
const HomeScreen = ({ navigation }: any) => {
  const handleExit = async () => {
    try {
      await stopTracking();
    } catch {}
    moveAppToBackground();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MontQuest</Text>
      <XPBar />
      <PixelButton title="Play" onPress={() => navigation.navigate('Map')} />
      <PixelButton title="Options" onPress={() => navigation.navigate('Settings')} />
      <PixelButton title="Exit" onPress={handleExit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center' },
  title: {
    color: '#0ff',
    fontFamily: 'monospace',
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: '#f0f',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
});

export default HomeScreen;
