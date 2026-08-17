import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { colors, gradients, radius, type } from '@/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Barra de progreso con degradado y animación. */
export function ProgressBar({
  ratio,
  gradient = gradients.aurora,
  height = 8,
  style,
}: {
  ratio: number;
  gradient?: readonly string[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 520 });
  }, [ratio, w]);

  const animated = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height }, style]}>
      <Animated.View style={[{ height, borderRadius: height, overflow: 'hidden' }, animated]}>
        <LinearGradient
          colors={gradient as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** Anillo de progreso circular (nivel, precisión). */
export function ProgressRing({
  ratio,
  size = 108,
  stroke = 10,
  from = '#2DD4BF',
  to = '#818CF8',
  children,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  from?: string;
  to?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, ratio)), { duration: 720 });
  }, [ratio, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Pastilla de estadística: valor grande + etiqueta. */
export function StatPill({
  value,
  label,
  color = colors.primary,
  style,
}: {
  value: string | number;
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={[type.h2, { color }]}>{value}</Text>
      <Text style={[type.label, { color: colors.textFaint, marginTop: 2 }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Fila de progreso de un modo: icono, nombre, estrellas ganadas sobre el total
 * y barra. El número en ámbar son las estrellas rellenas (países dominados).
 */
export function StarRow({
  label,
  icon,
  gradient,
  stars,
  mastered,
  total,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  gradient?: readonly string[];
  stars: number;
  mastered: number;
  total: number;
  onPress?: () => void;
}) {
  const body = (
    <View style={{ gap: 7 }}>
      <View style={styles.row}>
        <View style={styles.starRowSide}>
          {icon}
          <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
        </View>
        <View style={styles.starRowSide}>
          {mastered > 0 && (
            <Text style={[type.small, { color: colors.warning }]}>{mastered} dominados</Text>
          )}
          <Text style={[type.bodyStrong, { color: colors.text }]}>
            {stars}
            <Text style={[type.small, { color: colors.textFaint }]}>/{total}</Text>
          </Text>
        </View>
      </View>
      <ProgressBar ratio={total === 0 ? 0 : stars / total} height={6} gradient={gradient} />
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${stars} de ${total} estrellas. Jugar`}
      style={({ pressed }) => (pressed ? { opacity: 0.65 } : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** Contador de la ronda: 3 / 12 + barra. */
export function QuizProgress({
  index,
  total,
  gradient,
}: {
  index: number;
  total: number;
  gradient?: readonly string[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Text style={[type.label, { color: colors.textFaint }]}>
          PREGUNTA {index + 1} / {total}
        </Text>
      </View>
      <ProgressBar ratio={(index) / total} gradient={gradient} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starRowSide: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
