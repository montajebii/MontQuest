import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../state/GameContext';
import { xpForLevel } from '../utils/leveling';

/** TopBar: Coins | Level | XP progress (spec §4 MapScreen / HomeScreen). */
const XPBar: React.FC = () => {
  const { profile } = useGame();
  if (!profile) {return null;}
  const need = xpForLevel(profile.level);
  const pct = Math.max(0, Math.min(1, profile.current_xp / need));
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.coins}>🪙 {profile.coins}</Text>
        <Text style={styles.level}>Lv {profile.level}</Text>
        <Text style={styles.xp}>
          {profile.current_xp}/{need} XP
        </Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    padding: 8,
    backgroundColor: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  coins: { color: '#ffd700', fontFamily: 'monospace', fontWeight: 'bold' },
  level: { color: '#0ff', fontFamily: 'monospace', fontWeight: 'bold' },
  xp: { color: '#fff', fontFamily: 'monospace' },
  barBg: {
    marginTop: 6,
    height: 12,
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: '#fff',
  },
  barFill: { height: '100%', backgroundColor: '#0f0' },
});

export default XPBar;
