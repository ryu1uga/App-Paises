import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  delay?: number;
  from?: 'bottom' | 'top' | 'left' | 'right' | 'scale';
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  /** Cambia este valor para volver a lanzar la animación. */
  trigger?: unknown;
};

/** Entrada animada reutilizable (fade + desplazamiento). */
export function Reveal({
  children,
  delay = 0,
  from = 'bottom',
  distance = 18,
  duration = 420,
  style,
  trigger,
}: Props) {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration, p, trigger]);

  const animated = useAnimatedStyle(() => {
    const t = 1 - p.value;
    const transform: { translateX?: number; translateY?: number; scale?: number }[] = [];
    if (from === 'bottom') transform.push({ translateY: t * distance });
    if (from === 'top') transform.push({ translateY: -t * distance });
    if (from === 'left') transform.push({ translateX: -t * distance });
    if (from === 'right') transform.push({ translateX: t * distance });
    if (from === 'scale') transform.push({ scale: 0.92 + p.value * 0.08 });
    return { opacity: p.value, transform: transform as never };
  });

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
