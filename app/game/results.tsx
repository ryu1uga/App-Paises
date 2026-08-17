import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { Flag } from '@/components/Flag';
import { GlassCard } from '@/components/GlassCard';
import { ProgressBar, ProgressRing, StatPill } from '@/components/Meters';
import { GhostButton, PrimaryButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { byId } from '@/data/countries';
import { MODE_META } from '@/lib/quiz';
import { STARS_PER_MODE, starsIn, useProgress } from '@/store/progress';
import { gradeFor, useSession } from '@/store/session';
import { colors, gradients, radius, spacing, type } from '@/theme/theme';

export default function Results() {
  const router = useRouter();
  const session = useSession();
  const finishRun = useProgress((s) => s.finishRun);
  const stats = useProgress((s) => s.stats);

  const answers = session.answers;
  const correct = answers.filter((a) => a.correct).length;
  const total = Math.max(1, answers.length);
  const ratio = correct / total;
  const points = answers.reduce((a, x) => a + x.points, 0);
  const stars = answers.filter((a) => a.newStar).length;
  const mastered = answers.filter((a) => a.newMastered).length;
  const duration = Date.now() - session.startedAt;
  const grade = gradeFor(ratio);
  const meta = MODE_META[session.mode];

  // Las estrellas se anotaron respuesta a respuesta, así que este contador ya
  // incluye las de esta ronda; el "antes" sale de restarlas.
  const modeStars = starsIn(stats, session.mode);

  const [outcome, setOutcome] = React.useState<{
    rank: string;
    rankUp: boolean;
    stars: number;
  } | null>(null);

  React.useEffect(() => {
    if (!answers.length) return;
    setOutcome(
      finishRun({
        mode: session.mode,
        region: session.region,
        correct,
        total: answers.length,
        points,
        stars,
        mastered,
        bestStreak: session.bestStreak,
        duration,
      })
    );
    // Solo debe ejecutarse una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrong = answers.filter((a) => !a.correct);
  const celebrate = ratio >= 0.85 || !!outcome?.rankUp || stars > 0;

  return (
    <Screen>
      <Confetti show={celebrate} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: spacing.lg }}
      >
        <Reveal from="scale">
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={[`${grade.gradient[0]}2E`, `${grade.gradient[1]}0D`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ProgressRing
              ratio={ratio}
              size={132}
              stroke={12}
              from={grade.gradient[0]}
              to={grade.gradient[1]}
            >
              <Text style={[type.hero, { color: colors.text }]}>{Math.round(ratio * 100)}</Text>
              <Text style={[type.label, { color: colors.textFaint }]}>% ACIERTOS</Text>
            </ProgressRing>
            <Text style={[type.h1, { color: colors.text, marginTop: 16 }]}>{grade.title}</Text>
            <Text style={[type.body, { color: colors.textDim, textAlign: 'center' }]}>
              {grade.sub}
            </Text>
            <View style={styles.modeTag}>
              <Ionicons name={meta.icon as never} size={13} color={meta.gradient[0]} />
              <Text style={[type.small, { color: colors.textDim }]}>
                {meta.title} · {session.region ?? 'Todo el mundo'}
              </Text>
            </View>
          </View>
        </Reveal>

        {outcome?.rankUp && (
          <Reveal delay={120}>
            <GlassCard accent={gradients.sunset} padding={16}>
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Ionicons name="trophy" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: colors.text }]}>¡Ahora eres {outcome.rank}!</Text>
                  <Text style={[type.small, { color: colors.textDim }]}>
                    Nuevo rango desbloqueado por tu colección de estrellas
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Reveal>
        )}

        <Reveal delay={160}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatPill value={`+${stars}`} label="estrellas" color={colors.warning} />
            <StatPill value={`${correct}/${answers.length}`} label="aciertos" color={colors.secondary} />
            <StatPill value={points} label="puntos" />
          </View>
        </Reveal>

        {/* Dónde queda el modo tras esta ronda: es el progreso que de verdad cuenta. */}
        <Reveal delay={190}>
          <GlassCard padding={18} accent={meta.gradient}>
            <View style={styles.rowBetween}>
              <View style={styles.starTitle}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={[type.h3, { color: colors.text }]}>{meta.title}</Text>
              </View>
              <Text style={[type.h3, { color: colors.warning }]}>
                {modeStars}/{STARS_PER_MODE}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <ProgressBar ratio={modeStars / STARS_PER_MODE} gradient={meta.gradient} />
            </View>
            <Text style={[type.small, { color: colors.textFaint, marginTop: 8 }]}>
              {stars > 0
                ? `+${stars} ${stars === 1 ? 'estrella nueva' : 'estrellas nuevas'} en esta ronda` +
                  (mastered > 0
                    ? ` · ${mastered} ${mastered === 1 ? 'país dominado' : 'países dominados'}`
                    : '')
                : `Te quedan ${STARS_PER_MODE - modeStars} países por sacar en este modo.`}
            </Text>
          </GlassCard>
        </Reveal>

        {wrong.length > 0 && (
          <Reveal delay={220}>
            <GlassCard padding={18}>
              <Text style={[type.label, { color: colors.textFaint, marginBottom: 12 }]}>
                PARA REPASAR
              </Text>
              <View style={{ gap: 12 }}>
                {wrong.slice(0, 8).map((a) => {
                  const c = byId[a.countryId];
                  if (!c) return null;
                  const detail =
                    session.mode === 'capitals'
                      ? `Capital: ${c.capital}`
                      : a.given && byId[a.given]
                        ? `Elegiste ${byId[a.given].nameEs}`
                        : c.subregion;

                  return (
                    <Pressable
                      key={a.countryId}
                      onPress={() =>
                        router.push({ pathname: '/country/[id]', params: { id: c.id } })
                      }
                      style={({ pressed }) => [styles.reviewRow, pressed && styles.reviewRowPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.nameEs}. ${detail}. Ver ficha del país`}
                    >
                      <Flag id={c.id} width={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: colors.text }]}>{c.nameEs}</Text>
                        <Text style={[type.small, { color: colors.textFaint }]}>{detail}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Reveal>
        )}

        <Reveal delay={280} style={{ gap: 10 }}>
          <PrimaryButton
            label="Otra ronda"
            gradient={meta.gradient}
            onPress={() =>
              router.replace(session.mode === 'locate' ? '/game/locate' : '/game/play')
            }
            icon={<Ionicons name="refresh" size={18} color="#04121A" />}
          />
          <GhostButton
            label="Volver al inicio"
            onPress={() => router.replace('/')}
            icon={<Ionicons name="home-outline" size={17} color={colors.text} />}
          />
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  starTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.16)',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewRowPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
