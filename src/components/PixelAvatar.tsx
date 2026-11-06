import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AVATAR_PALETTE,
  AVATAR_SPRITES,
  getAvatarTier,
} from '../utils/avatars';

const CELL = 18;

/**
 * Code-driven pixel avatar (Could-have #2): renders the 8×8 sprite grid of
 * the hero's current tier as colored square Views — no binary image assets.
 */
const PixelAvatar: React.FC<{ level: number }> = ({ level }) => {
  const tier = getAvatarTier(level);
  const grid = AVATAR_SPRITES[tier].grid;
  return (
    <View
      style={styles.frame}
      accessibilityLabel={`آواتار پیکسلی ردهٔ ${AVATAR_SPRITES[tier].name}`}
      importantForAccessibility="no-hide-descendants">
      {grid.map((row, y) => (
        <View key={y} style={styles.row}>
          {row.split('').map((ch, x) => (
            <View
              key={x}
              style={[styles.cell, ch !== '.' && { backgroundColor: AVATAR_PALETTE[ch] }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#000',
    padding: 4,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row' },
  cell: { width: CELL, height: CELL },
});

export default PixelAvatar;
