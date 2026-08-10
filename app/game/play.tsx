import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Flag } from '@/components/Flag';
import { GlassCard } from '@/components/GlassCard';
import { QuizProgress } from '@/components/Meters';
import { OptionButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import type { Country } from '@/data/countries';
import { buildQuiz, MODE_META, scoreAnswer, type Question } from '@/lib/quiz';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colors, radius, spacing, type } from '@/theme/theme';

/** Pantalla común a los modos de opción múltiple: banderas, banderas inversas y capitales. */
export default function Play() {
  const router = useRouter();
  const { mode, region, length } = useSession();
  const begin = useSession((s) => s.begin);
  const push = useSession((s) => s.push);
  const streak = useSession((s) => s.streak);
  const registerAnswer = useProgress((s) => s.registerAnswer);

  const [questions] = React.useState<Question[]>(() =>
    buildQuiz({ mode, region, length })
  );
  const [index, setIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const askedAt = React.useRef(Date.now());
  const shake = useSharedValue(0);

  const meta = MODE_META[mode];
  const q = questions[index];

  React.useEffect(() => {
    begin();
  }, [begin]);

  React.useEffect(() => {
    askedAt.current = Date.now();
    setPicked(null);
  }, [index]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const answer = (country: Country) => {
    if (picked) return;
    const ms = Date.now() - askedAt.current;
    const correct = country.id === q.target.id;
    setPicked(country.id);

    const points = scoreAnswer({ correct, msElapsed: ms, streak, difficulty: q.target.difficulty });
    push({ countryId: q.target.id, correct, given: country.id, points, ms });
    registerAnswer(q.target.id, correct);

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withSpring(0, { damping: 12 })
      );
    }

    setTimeout(() => {
      if (index + 1 >= questions.length) router.replace('/game/results');
      else setIndex((i) => i + 1);
    }, correct ? 620 : 1150);
  };

  if (!q) return null;

  const stateFor = (option: Country) => {
    if (!picked) return 'idle' as const;
    if (option.id === q.target.id) return 'correct' as const;
    if (option.id === picked) return 'wrong' as const;
    return 'muted' as const;
  };

  const isFlagQuestion = mode === 'flags';
  const isReverse = mode === 'flagsReverse';

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/')} style={styles.iconBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <QuizProgress index={index} total={questions.length} gradient={meta.gradient} />
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flash" size={13} color={colors.warning} />
            <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
          </View>
        </View>

        {/* Enunciado */}
        <Animated.View style={shakeStyle}>
          <Reveal trigger={index} from="scale" key={`prompt-${index}`}>
            <GlassCard padding={0} accent={meta.gradient} borderRadius={radius.xl}>
              <View style={styles.prompt}>
                {isFlagQuestion ? (
                  <Flag code={q.target.code} emoji={q.target.flag} width={210} rounded={radius.md} />
                ) : (
                  <>
                    <Text style={[type.label, { color: colors.textFaint }]}>
                      {isReverse ? '¿CUÁL ES SU BANDERA?' : '¿CUÁL ES LA CAPITAL DE?'}
                    </Text>
                    <Text style={[type.hero, { color: colors.text, textAlign: 'center', marginTop: 8 }]}>
                      {q.target.nameEs}
                    </Text>
                    <Text style={[type.small, { color: colors.textDim, marginTop: 6 }]}>
                      {q.target.subregion}
                    </Text>
                  </>
                )}
                {isFlagQuestion && (
                  <Text style={[type.label, { color: colors.textFaint, marginTop: 16 }]}>
                    ¿DE QUÉ PAÍS ES ESTA BANDERA?
                  </Text>
                )}
              </View>
            </GlassCard>
          </Reveal>
        </Animated.View>

        {/* Opciones */}
        <View style={{ gap: 10, flex: 1 }}>
          {q.options.map((option, i) => (
            <Reveal key={`${index}-${option.id}`} delay={60 + i * 55} from="right">
              <OptionButton
                label={optionLabel(mode, option)}
                sublabel={picked && option.id === q.target.id ? option.subregion : undefined}
                state={stateFor(option)}
                onPress={() => answer(option)}
                disabled={!!picked}
                leading={
                  isReverse ? (
                    <Flag code={option.code} emoji={option.flag} width={54} />
                  ) : (
                    <View style={styles.bullet}>
                      <Text style={[type.bodyStrong, { color: colors.textDim }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                  )
                }
              />
            </Reveal>
          ))}
        </View>

        {/* Aviso de respuesta correcta cuando se falla */}
        {picked && picked !== q.target.id && (
          <Reveal from="bottom">
            <View style={styles.correctionBar}>
              <Ionicons name="information-circle" size={18} color={colors.secondary} />
              <Text style={[type.small, { color: colors.textDim, flex: 1 }]}>
                {mode === 'capitals'
                  ? `La capital de ${q.target.nameEs} es ${q.target.capital}.`
                  : `Era ${q.target.nameEs} · ${q.target.subregion}.`}
              </Text>
            </View>
          </Reveal>
        )}
      </View>
    </Screen>
  );
}

function optionLabel(mode: string, c: Country): string {
  if (mode === 'capitals') return c.capital;
  return c.nameEs;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  prompt: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  correctionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
});
