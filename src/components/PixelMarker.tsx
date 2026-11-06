import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Square pixel-art quest marker used inside MapLibre PointAnnotation.
 * Square + hard 2px border keeps the 8-bit look (no rounded pins).
 */
const PixelMarker: React.FC<{ active: boolean }> = ({ active }) => (
  <View
    style={[styles.marker, active ? styles.active : styles.done]}
    importantForAccessibility="no-hide-descendants"
    accessibilityElementsHidden
  />
);

const styles = StyleSheet.create({
  marker: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#0b0b12',
    shadowColor: '#0b0b12',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  active: { backgroundColor: '#2fbf3f' },
  done: { backgroundColor: '#5a5a66' },
});

export default PixelMarker;
