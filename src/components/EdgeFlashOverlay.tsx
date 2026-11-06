import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

/**
 * Blinking border overlay for the "nearby" state (AC-04).
 * Loops for as long as `visible` is true (i.e. while the confirm dialog
 * is open) and stops cleanly when hidden.
 */
const EdgeFlashOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );
      animation.current.start();
    } else {
      animation.current?.stop();
      animation.current = null;
    }
    return () => {
      animation.current?.stop();
      animation.current = null;
    };
  }, [visible, opacity]);

  if (!visible) {return null;}
  return <Animated.View pointerEvents="none" style={[styles.edge, { opacity }]} />;
};

const styles = StyleSheet.create({
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 12,
    borderColor: '#f0f',
  },
});

export default EdgeFlashOverlay;
