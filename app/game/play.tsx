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
import { buildQuiz, MODE_META, scoreAnswer, type GameMode, type Question } from '@/lib/quiz';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colors, radius, spacing, type } from '@/theme/theme';

/**
 * Pantalla común a los cuatro modos de opción múltiple: banderas, bandera
 * inversa, capitales y capital inversa. Lo único que cambia entre ellos es qué
 * se enseña arriba y qué se lee en los botones.
 */
export default function Play() {
  const router = useRouter();
  const { mode, region, length } = useSession();
  const begin = useSession((s) => s.begin);
  const push = useSession((s) => s.push);
  const streak = useSession((s) => s.streak);
  const registerAnswer = useProgress((s) => s.registerAnswer);

  // Las estadísticas se leen una sola vez, al montar: así la ronda se sortea con
  // repetición espaciada sin que las respuestas la vayan alterando sobre la marcha.
  const [questions] = React.useState<Question[]>(() =>
    buildQuiz({ mode, region, length, stats: useProgress.getState().stats })
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

    const points = scoreAnswer({
      correct,
      msElapsed: ms,
      streak,
      difficulty: q.target.difficulty,
      mode,
    });
    // El store es quien sabe si esta respuesta ganó estrella, así que se anota
    // primero y su respuesta viaja en el log hasta la pantalla de resultados.
    const gain = registerAnswer(q.target.id, mode, correct);
    push({
      countryId: q.target.id,
      correct,
      given: country.id,
      points,
      ms,
      newStar: gain.newStar,
      newMastered: gain.newMastered,
    });

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

  // Qué se enseña arriba y qué se enseña en los botones. Los tres modos
  // "directos" preguntan por el país; los inversos parten del dato y piden el país.
  const showsFlagPrompt = mode === 'flags';
  const showsFlagOptions = mode === 'flagsReverse';
  const prompt = promptFor(mode, q.target);

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace('/')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Salir de la partida"
          >
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
                {showsFlagPrompt ? (
                  <>
                    <Flag id={q.target.id} width={210} rounded={radius.md} />
                    <Text style={[type.label, { color: colors.textFaint, marginTop: 16 }]}>
                      {prompt.question}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[type.label, { color: colors.textFaint }]}>{prompt.question}</Text>
                    <Text
                      style={[type.hero, { color: colors.text, textAlign: 'center', marginTop: 8 }]}
                      maxFontSizeMultiplier={1.4}
                    >
                      {prompt.subject}
                    </Text>
                    <Text style={[type.small, { color: colors.textDim, marginTop: 6 }]}>
                      {q.target.subregion}
                    </Text>
                  </>
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
                  showsFlagOptions ? (
                    <Flag id={option.id} width={54} />
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
                {correction(mode, q.target)}
              </Text>
            </View>
          </Reveal>
        )}
      </View>
    </Screen>
  );
}

/**
 * Qué se lee en el botón. Solo Capitales pide capitales; en su inverso las
 * capitales están arriba y los botones vuelven a ser países.
 */
function optionLabel(mode: GameMode, c: Country): string {
  return mode === 'capitals' ? c.capital : c.nameEs;
}

/** El enunciado: la pregunta y el dato del que se parte. */
function promptFor(mode: GameMode, c: Country): { question: string; subject: string } {
  switch (mode) {
    case 'flags':
      return { question: '¿DE QUÉ PAÍS ES ESTA BANDERA?', subject: c.nameEs };
    case 'flagsReverse':
      return { question: '¿CUÁL ES SU BANDERA?', subject: c.nameEs };
    case 'capitals':
      return { question: '¿CUÁL ES LA CAPITAL DE?', subject: c.nameEs };
    case 'capitalsReverse':
      return { question: '¿DE QUÉ PAÍS ES CAPITAL?', subject: c.capital };
    default:
      return { question: '¿QUÉ PAÍS ES?', subject: c.nameEs };
  }
}

/** La aclaración que aparece al fallar, dicha en la dirección del modo. */
function correction(mode: GameMode, c: Country): string {
  if (mode === 'capitals') return `La capital de ${c.nameEs} es ${c.capital}.`;
  if (mode === 'capitalsReverse') return `${c.capital} es la capital de ${c.nameEs}.`;
  return `Era ${c.nameEs} · ${c.subregion}.`;
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
