import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/**
 * 8-bit user-position marker: a white-bordered pixel square with a
 * blinking yellow core — clearly visible on the dark map style.
 * Rendered inside <UserLocation> (children replace the default puck,
 * verified in the v10.4.2 implementation).
 */
const PixelUserDot: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);

  return (
    <View style={styles.ring} pointerEvents="none">
      <Animated.View style={[styles.core, { opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#f8f8f8',
    backgroundColor: '#0b0b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 14,
    height: 14,
    backgroundColor: '#f8d838',
  },
});

export default PixelUserDot;
