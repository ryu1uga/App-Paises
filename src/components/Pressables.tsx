import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, gradients, radius, shadow, type } from '@/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Hook con el "muelle" de pulsación usado por todos los botones. */
function usePressScale(min = 0.96) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(min, { damping: 18, stiffness: 320 });
    },
    onPressOut: () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 260 });
    },
  };
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  gradient?: readonly string[];
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  haptic?: boolean;
  /** Texto para lectores de pantalla si el visible no basta. */
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  gradient = gradients.aurora,
  icon,
  disabled,
  style,
  size = 'lg',
  haptic = true,
  accessibilityLabel,
}: ButtonProps) {
  const press = usePressScale();
  // `minHeight` en vez de `height`: con el texto grande del sistema el botón
  // crece en lugar de recortar la etiqueta.
  const minHeight = size === 'lg' ? 56 : 46;

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[press.style, { opacity: disabled ? 0.45 : 1 }, style]}
    >
      <View style={[styles.btnShadow, shadow.glow(gradient[0])]}>
        <LinearGradient
          colors={gradient as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, { minHeight, borderRadius: radius.pill }]}
        >
          {icon}
          <Text
            style={[type.h3, styles.btnLabel, size === 'md' && { fontSize: 15 }]}
            maxFontSizeMultiplier={1.5}
          >
            {label}
          </Text>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  style,
  disabled,
  accessibilityLabel,
}: ButtonProps) {
  const press = usePressScale(0.97);
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[press.style, styles.ghost, { opacity: disabled ? 0.4 : 1 }, style]}
    >
      {icon}
      <Text style={[type.bodyStrong, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

type OptionState = 'idle' | 'correct' | 'wrong' | 'muted';

export function OptionButton({
  label,
  sublabel,
  state = 'idle',
  onPress,
  disabled,
  leading,
  style,
}: {
  label: string;
  sublabel?: string;
  state?: OptionState;
  onPress: () => void;
  disabled?: boolean;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // El color no puede ser el único canal: lo decimos también con palabras.
  const spoken =
    state === 'correct'
      ? `${label}. Respuesta correcta`
      : state === 'wrong'
        ? `${label}. Respuesta incorrecta`
        : label;

  const press = usePressScale(0.975);
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(state === 'idle' ? 0 : 1, { duration: 220 });
  }, [state, progress]);

  const palette = {
    idle: { bg: 'rgba(255,255,255,0.055)', border: colors.border, text: colors.text },
    correct: { bg: colors.successBg, border: colors.success, text: colors.success },
    wrong: { bg: colors.dangerBg, border: colors.danger, text: colors.danger },
    muted: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)', text: colors.textFaint },
  }[state];

  const animated = useAnimatedStyle(() => ({
    opacity: state === 'muted' ? withTiming(0.45) : withTiming(1),
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        press.style,
        animated,
        styles.option,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text
          style={[type.bodyStrong, { color: palette.text }]}
          numberOfLines={3}
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </Text>
        {!!sublabel && (
          <Text
            style={[type.small, { color: colors.textFaint, marginTop: 2 }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {sublabel}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

/** Chip de filtro (continentes, dificultad…). */
export function Chip({
  label,
  active,
  onPress,
  color = colors.primary,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={[
        styles.chip,
        active && { backgroundColor: `${color}26`, borderColor: color },
      ]}
    >
      <Text
        style={[
          type.small,
          { fontFamily: 'Inter_600SemiBold', color: active ? color : colors.textDim },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btnShadow: { borderRadius: radius.pill },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 26,
  },
  btnLabel: { color: '#04121A' },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  chip: {
    paddingHorizontal: 14,
    minHeight: 34,
    paddingVertical: 6,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
