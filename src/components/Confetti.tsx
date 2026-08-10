import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/theme/theme';

const COLORS = [palette.mint, palette.aqua, palette.iris, palette.amber, palette.magenta, palette.lime];
const { width: SW, height: SH } = Dimensions.get('window');

function Piece({ index }: { index: number }) {
  const progress = useSharedValue(0);

  const cfg = React.useMemo(() => {
    const x = Math.random() * SW;
    return {
      x,
      drift: (Math.random() - 0.5) * 160,
      size: 6 + Math.random() * 8,
      color: COLORS[index % COLORS.length],
      delay: Math.random() * 500,
      duration: 1600 + Math.random() * 1200,
      spin: (Math.random() - 0.5) * 900,
      round: Math.random() > 0.6,
    };
  }, [index]);

  React.useEffect(() => {
    progress.value = withDelay(
      cfg.delay,
      withTiming(1, { duration: cfg.duration, easing: Easing.out(Easing.quad) })
    );
  }, [cfg, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -40 + progress.value * (SH + 80) },
      { translateX: progress.value * cfg.drift },
      { rotate: `${progress.value * cfg.spin}deg` },
    ],
    opacity: progress.value > 0.85 ? (1 - progress.value) / 0.15 : 1,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cfg.x,
          top: 0,
          width: cfg.size,
          height: cfg.size * (cfg.round ? 1 : 1.8),
          borderRadius: cfg.round ? cfg.size : 2,
          backgroundColor: cfg.color,
        },
        style,
      ]}
    />
  );
}

/** Lluvia de confeti para celebrar rondas perfectas o subidas de nivel. */
export function Confetti({ count = 46, show }: { count?: number; show: boolean }) {
  if (!show) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}
