import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { flagSource } from '@/data/flags';
import { radius } from '@/theme/theme';

type Props = {
  /** Código alfa-3 del país. */
  id: string;
  /** Nombre para lectores de pantalla; sin él la bandera se marca decorativa. */
  name?: string;
  width?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
};

/**
 * Bandera empaquetada en la app: ni red ni emojis (que Android no dibuja).
 *
 * El marco es 3:2, pero cada bandera se encaja con `contain` porque conservan su
 * proporción real: Nepal no es rectangular y Suiza es cuadrada.
 */
export function Flag({ id, name, width = 64, style, rounded = radius.sm }: Props) {
  const source = flagSource(id);
  const height = Math.round((width * 2) / 3);

  return (
    <View
      style={[styles.frame, { width, height, borderRadius: rounded }, style]}
      accessible={!!name}
      accessibilityRole={name ? 'image' : undefined}
      accessibilityLabel={name ? `Bandera de ${name}` : undefined}
      importantForAccessibility={name ? 'yes' : 'no-hide-descendants'}
    >
      {source !== undefined && (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={160}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
});
