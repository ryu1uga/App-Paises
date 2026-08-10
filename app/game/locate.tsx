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
import { bearingLabel, distanceScore, formatDistance, haversine } from '@/lib/geo';
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
  }, [index]);

  const distance = React.useMemo(() => {
    if (!guess || !target) return null;
    return haversine(guess, { lat: target.lat, lng: target.lng });
  }, [guess, target]);

  const confirm = () => {
    if (!target) return;
    const center = globe.current?.getCenter();
    const point = guess ?? center;
    if (!point) return;

    const km = haversine(point, { lat: target.lat, lng: target.lng });
    const score = distanceScore(km);
    const correct = score >= 55;
    const ms = Date.now() - askedAt.current;

    setGuess(point);
    setPhase('revealed');
    push({
      countryId: target.id,
      correct,
      distanceKm: km,
      points: Math.round(score * (1 + Math.min(5, streak) * 0.06)),
      ms,
    });
    registerAnswer(target.id, correct);

    void Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    globe.current?.flyTo(target.lat, target.lng, { zoom: 2.5, duration: 1100 });
  };

  const next = () => {
    if (index + 1 >= questions.length) router.replace('/game/results');
    else setIndex((i) => i + 1);
  };

  const markers = React.useMemo<GlobeMarker[]>(() => {
    if (phase !== 'revealed' || !target || !guess) return [];
    return [
      { id: 'guess', lat: guess.lat, lng: guess.lng, color: '#FB7185', kind: 'pin' },
      { id: 'target', lat: target.lat, lng: target.lng, color: '#2DD4BF', kind: 'pulse' },
    ];
  }, [phase, target, guess]);

  const arc = React.useMemo(
    () =>
      phase === 'revealed' && target && guess
        ? { from: guess, to: { lat: target.lat, lng: target.lng }, color: '#FBBF24' }
        : null,
    [phase, target, guess]
  );

  if (!target) return null;

  const score = distance != null ? distanceScore(distance) : 0;

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
                    : 'Gira el globo y toca el lugar exacto. Pellizca para hacer zoom.'}
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
                accent={score >= 55 ? gradients.success : gradients.danger}
              >
                <View style={styles.resultRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.h2, { color: score >= 55 ? colors.success : colors.danger }]}>
                      {resultTitle(score)}
                    </Text>
                    <Text style={[type.small, { color: colors.textDim, marginTop: 4 }]}>
                      {distance != null && distance < 60
                        ? '¡Justo en el sitio!'
                        : `A ${formatDistance(distance ?? 0)} · estaba al ${bearingLabel(
                            guess!,
                            { lat: target.lat, lng: target.lng }
                          )}`}
                    </Text>
                  </View>
                  <View style={styles.scoreBubble}>
                    <Text style={[type.h2, { color: colors.text }]}>{score}</Text>
                    <Text style={[type.label, { color: colors.textFaint }]}>PTS</Text>
                  </View>
                </View>

                <View style={{ marginTop: 14 }}>
                  <ProgressBar
                    ratio={score / 100}
                    gradient={score >= 55 ? gradients.success : gradients.ember}
                  />
                </View>

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

function resultTitle(score: number): string {
  if (score >= 95) return '¡Clavado!';
  if (score >= 75) return '¡Muy cerca!';
  if (score >= 55) return 'Aceptable';
  if (score >= 25) return 'Lejos';
  return 'Otro continente…';
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
  scoreBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
