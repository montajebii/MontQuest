import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Optional explicit label for screen readers; defaults to `title`. */
  accessibilityLabel?: string;
}

const PixelButton: React.FC<Props> = ({
  title,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled: !!disabled }}
    style={[styles.btn, disabled && styles.disabled, style]}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#111',
    borderColor: '#fff',
    borderWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginVertical: 6,
    borderRadius: 0,
    shadowColor: '#f0f',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  disabled: { opacity: 0.4 },
  label: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
});

export default PixelButton;
