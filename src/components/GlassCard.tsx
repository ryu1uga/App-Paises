import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Borde con degradado de acento. */
  accent?: readonly string[] | null;
  padding?: number;
  borderRadius?: number;
};

/**
 * Tarjeta "glassmorphism": blur en iOS, superficie translúcida en Android
 * (el blur en Android es costoso y poco fiel).
 */
export function GlassCard({
  children,
  style,
  intensity = 26,
  accent = null,
  padding = 16,
  borderRadius = radius.lg,
}: Props) {
  const content = (
    <View style={{ padding }}>
      {children}
    </View>
  );

  return (
    <View style={[styles.wrap, { borderRadius }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
      )}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      {accent && (
        <LinearGradient
          colors={accent as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentBar}
        />
      )}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  androidFill: { backgroundColor: 'rgba(17,22,43,0.72)' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
});
