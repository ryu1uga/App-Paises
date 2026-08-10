import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { flagUrl } from '@/data/countries';
import { radius } from '@/theme/theme';

type Props = {
  code: string;
  emoji?: string;
  width?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
};

/**
 * Bandera en alta resolución desde flagcdn (con caché en disco de expo-image).
 * Si no hay red, cae al emoji del dataset.
 */
export function Flag({ code, emoji, width = 64, style, rounded = radius.sm }: Props) {
  const [failed, setFailed] = React.useState(false);
  const height = Math.round((width * 2) / 3);

  if (failed && emoji) {
    return (
      <View style={[styles.fallback, { width, height, borderRadius: rounded }, style]}>
        <Text style={{ fontSize: width * 0.62 }}>{emoji}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { width, height, borderRadius: rounded }, style]}>
      <Image
        source={{ uri: flagUrl(code, width > 160 ? 640 : 320) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={220}
        cachePolicy="disk"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
});
