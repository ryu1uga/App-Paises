import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { ProgressBar } from '@/components/Meters';
import { PrimaryButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { Globe, type GlobeHandle, type GlobeMarker } from '@/globe/Globe';
import { bearingLabel, formatDistance, haversine } from '@/lib/geo';
import { evaluateLocate, locateScore, type LocateOutcome } from '@/lib/locate';
import { buildQuiz, type Question } from '@/lib/quiz';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colors, gradients, radius, spacing, type } from '@/theme/theme';

type Phase = 'aiming' | 'revealed';

export default function Locate() {
  const router = useRouter();
  const { region, length } = useSession();
  const begin = useSession((s) => s.begin);
  const push = useSession((s) => s.push);
  const streak = useSession((s) => s.streak);
  const registerAnswer = useProgress((s) => s.registerAnswer);

  const globe = React.useRef<GlobeHandle>(null);
  const [questions] = React.useState<Question[]>(() =>
    buildQuiz({ mode: 'locate', region, length })
  );
  const [index, setIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>('aiming');
  const [guess, setGuess] = React.useState<{ lat: number; lng: number } | null>(null);
  const [outcome, setOutcome] = React.useState<LocateOutcome | null>(null);
  const askedAt = React.useRef(Date.now());

  const q = questions[index];
  const target = q?.target;

  React.useEffect(() => {
    begin();
  }, [begin]);

  React.useEffect(() => {
    askedAt.current = Date.now();
    setPhase('aiming');
    setGuess(null);
    setOutcome(null);
  }, [index]);

  const confirm = () => {
    if (!target) return;
    const center = globe.current?.getCenter();
    const point = guess ?? center;
    if (!point) return;

    const ms = Date.now() - askedAt.current;
    const result = evaluateLocate(point, target);
    const points = locateScore({
      correct: result.correct,
      msElapsed: ms,
      streak,
      difficulty: target.difficulty,
    });

    setGuess(point);
    setOutcome(result);
    setPhase('revealed');
    push({
      countryId: target.id,
      correct: result.correct,
      distanceKm: result.distanceKm,
      points,
      ms,
    });
    registerAnswer(target.id, result.correct);

    void Haptics.notificationAsync(
      result.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );
    globe.current?.flyTo(target.lat, target.lng, { zoom: 2.5, duration: 1100 });
  };

  const next = () => {
    if (index + 1 >= questions.length) router.replace('/game/results');
    else setIndex((i) => i + 1);
  };

  const markers = React.useMemo<GlobeMarker[]>(() => {
    if (phase !== 'revealed' || !target || !guess) return [];
    // Si acertó, un solo marcador verde: el arco hacia el centro del país sobra.
    if (outcome?.correct) {
      return [{ id: 'guess', lat: guess.lat, lng: guess.lng, color: '#34D399', kind: 'pulse' }];
    }
    return [
      { id: 'guess', lat: guess.lat, lng: guess.lng, color: '#FB7185', kind: 'pin' },
      { id: 'target', lat: target.lat, lng: target.lng, color: '#2DD4BF', kind: 'pulse' },
    ];
  }, [phase, target, guess, outcome]);

  const arc = React.useMemo(
    () =>
      phase === 'revealed' && target && guess && !outcome?.correct
        ? { from: guess, to: { lat: target.lat, lng: target.lng }, color: '#FBBF24' }
        : null,
    [phase, target, guess, outcome]
  );

  if (!target) return null;

  return (
    <Screen edges={['top']}>
      <View style={styles.root}>
        <Globe
          ref={globe}
          style={StyleSheet.absoluteFill}
          autoRotate={false}
          interactive
          showReticle={phase === 'aiming'}
          markers={markers}
          arc={arc}
          initial={{ lat: 15, lng: 0, zoom: 3.4 }}
          onPickPoint={phase === 'aiming' ? (p) => setGuess(p) : undefined}
        />

        <LinearGradient
          colors={['rgba(5,6,15,0.92)', 'rgba(5,6,15,0.35)', 'transparent']}
          style={styles.topFade}
          pointerEvents="none"
        />

        {/* Cabecera */}
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/')} style={styles.iconBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.label, { color: colors.textFaint }]}>
              {index + 1} / {questions.length}
            </Text>
            <ProgressBar ratio={index / questions.length} gradient={gradients.ocean} />
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flash" size={13} color={colors.warning} />
            <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
          </View>
        </View>

        {/* Objetivo */}
        <Reveal trigger={index} from="top" style={styles.questionWrap}>
          <GlassCard padding={16} accent={gradients.ocean} borderRadius={radius.lg}>
            <Text style={[type.label, { color: colors.textFaint }]}>ENCUENTRA</Text>
            <Text style={[type.h1, { color: colors.text, marginTop: 4 }]}>{target.nameEs}</Text>
            <Text style={[type.small, { color: colors.textDim, marginTop: 2 }]}>
              Capital: {target.capital} · {target.region}
            </Text>
          </GlassCard>
        </Reveal>

        {/* Panel inferior */}
        <View style={styles.bottom}>
          {phase === 'aiming' ? (
            <GlassCard padding={16} borderRadius={radius.xl}>
              <View style={styles.hintRow}>
                <Ionicons name="hand-left-outline" size={18} color={colors.secondary} />
                <Text style={[type.small, { color: colors.textDim, flex: 1 }]}>
                  {guess
                    ? `Marcado en ${fmtCoord(guess)}. Toca otro punto para corregir.`
                    : 'Gira el globo y toca dentro del país. Pellizca para hacer zoom.'}
                </Text>
              </View>
              <PrimaryButton
                label={guess ? 'Confirmar ubicación' : 'Usar el centro de la mira'}
                gradient={gradients.ocean}
                onPress={confirm}
                style={{ marginTop: 14 }}
                icon={<Ionicons name="locate" size={18} color="#04121A" />}
              />
            </GlassCard>
          ) : (
            <Reveal from="bottom">
              <GlassCard
                padding={18}
                borderRadius={radius.xl}
                accent={outcome?.correct ? gradients.success : gradients.danger}
              >
                <View style={styles.resultRow}>
                  <View style={[styles.verdictIcon, outcome?.correct ? styles.verdictOk : styles.verdictBad]}>
                    <Ionicons
                      name={outcome?.correct ? 'checkmark' : 'close'}
                      size={26}
                      color={outcome?.correct ? colors.success : colors.danger}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[type.h2, { color: outcome?.correct ? colors.success : colors.danger }]}
                    >
                      {outcome?.correct ? '¡Correcto!' : 'Fallaste'}
                    </Text>
                    <Text style={[type.small, { color: colors.textDim, marginTop: 4 }]}>
                      {feedback(outcome, target.nameEs)}
                    </Text>
                  </View>
                </View>

                {!outcome?.correct && outcome && guess && (
                  <View style={styles.missRow}>
                    <Ionicons name="navigate-outline" size={15} color={colors.textFaint} />
                    <Text style={[type.small, { color: colors.textFaint, flex: 1 }]}>
                      {target.nameEs} estaba a {formatDistance(outcome.distanceKm)} al{' '}
                      {bearingLabel(guess, { lat: target.lat, lng: target.lng })}
                    </Text>
                  </View>
                )}

                <PrimaryButton
                  label={index + 1 >= questions.length ? 'Ver resultados' : 'Siguiente país'}
                  gradient={gradients.ocean}
                  onPress={next}
                  style={{ marginTop: 16 }}
                  icon={<Ionicons name="arrow-forward" size={18} color="#04121A" />}
                />
              </GlassCard>
            </Reveal>
          )}
        </View>
      </View>
    </Screen>
  );
}

/** Texto bajo el veredicto: dice exactamente qué pasó. */
function feedback(outcome: LocateOutcome | null, targetName: string): string {
  if (!outcome) return '';
  if (outcome.reason === 'inside') return `Tu marcador cayó dentro de ${targetName}.`;
  if (outcome.reason === 'close') return `${targetName} es diminuto, pero diste en el clavo.`;
  if (outcome.hit) return `Eso es ${outcome.hit.nameEs}.`;
  return 'Marcaste en el mar.';
}

function fmtCoord(p: { lat: number; lng: number }): string {
  const ns = p.lat >= 0 ? 'N' : 'S';
  const ew = p.lng >= 0 ? 'E' : 'O';
  return `${Math.abs(p.lat).toFixed(1)}°${ns} ${Math.abs(p.lng).toFixed(1)}°${ew}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.16)',
  },
  questionWrap: { marginTop: spacing.md, marginHorizontal: spacing.lg },
  bottom: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  verdictIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  verdictOk: { backgroundColor: 'rgba(52,211,153,0.14)', borderColor: 'rgba(52,211,153,0.45)' },
  verdictBad: { backgroundColor: 'rgba(251,113,133,0.14)', borderColor: 'rgba(251,113,133,0.45)' },
  missRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
