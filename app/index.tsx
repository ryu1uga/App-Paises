import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { ProgressRing, StarRow } from '@/components/Meters';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { TOTAL_COUNTRIES } from '@/data/countries';
import { Globe } from '@/globe/Globe';
import { GAME_MODES, MODE_META, type GameMode } from '@/lib/quiz';
import {
  TOTAL_STARS,
  countMastered,
  countStars,
  rankForStars,
  selectAccuracy,
  selectModeProgress,
  useProgress,
} from '@/store/progress';
import { colors, gradients, radius, spacing, type } from '@/theme/theme';

const MODES: GameMode[] = GAME_MODES;

export default function Home() {
  const router = useRouter();
  const streak = useProgress((s) => s.streak);
  const stats = useProgress((s) => s.stats);

  const stars = countStars(stats);
  const mastered = countMastered(stats);
  const rank = rankForStars(stars);
  const modes = selectModeProgress(stats);
  const accuracy = selectAccuracy(stats);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 48, gap: spacing.lg }}
      >
        {/* Cabecera */}
        <Reveal from="top">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: colors.primary }]}>ATLAS QUEST</Text>
              <Text style={[type.hero, { color: colors.text, marginTop: 4 }]} maxFontSizeMultiplier={1.3}>
                Explora{'\n'}el mundo
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile')}
              style={styles.avatar}
              accessibilityRole="button"
              accessibilityLabel={`Tu perfil. ${stars} de ${TOTAL_STARS} estrellas. ${rank.title}`}
            >
              <LinearGradient
                colors={gradients.aurora as unknown as [string, string, string]}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="star" size={22} color="#04121A" />
            </Pressable>
          </View>
        </Reveal>

        {/* Globo destacado */}
        <Reveal delay={80} from="scale">
          <Pressable
            onPress={() => router.push('/explore')}
            accessibilityRole="button"
            accessibilityLabel={`Modo Explorar. Gira el planeta y descubre ${TOTAL_COUNTRIES} países`}
          >
            <View style={styles.globeCard}>
              <Globe
                style={StyleSheet.absoluteFill}
                autoRotate
                interactive={false}
                quality="lite"
                initial={{ lat: 12, lng: -30, zoom: 3.35 }}
              />
              <LinearGradient
                colors={['transparent', 'rgba(5,6,15,0.55)', 'rgba(5,6,15,0.95)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.globeFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: colors.text }]}>Modo Explorar</Text>
                  <Text style={[type.small, { color: colors.textDim }]}>
                    Gira el planeta y descubre {TOTAL_COUNTRIES} países
                  </Text>
                </View>
                <View style={styles.circleBtn}>
                  <Ionicons name="arrow-forward" size={20} color="#04121A" />
                </View>
              </View>
            </View>
          </Pressable>
        </Reveal>

        {/* Colección de estrellas: una por país y modo. */}
        <Reveal delay={140}>
          <GlassCard accent={gradients.aurora} padding={18}>
            <View style={styles.rowBetween}>
              <ProgressRing ratio={stars / TOTAL_STARS} size={124} stroke={11} from="#FBBF24" to="#FB7185">
                <Text style={[type.hero, { color: colors.text }]}>{stars}</Text>
                <Text style={[type.label, { color: colors.textFaint }]}>DE {TOTAL_STARS}</Text>
              </ProgressRing>

              <View style={styles.rankSide}>
                <View style={styles.streakChip}>
                  <Ionicons name="flame" size={15} color={colors.warning} />
                  <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
                </View>
                <Text style={[type.h3, { color: colors.text, marginTop: 12, textAlign: 'right' }]}>
                  {rank.title}
                </Text>
                <Text style={[type.small, { color: colors.textDim, textAlign: 'right' }]}>
                  {rank.next === null
                    ? 'Has coleccionado el mundo entero'
                    : `${rank.remaining} estrellas para el siguiente rango`}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 18, gap: 14 }}>
              {modes.map((m) => (
                <StarRow
                  key={m.mode}
                  label={MODE_META[m.mode].title}
                  icon={
                    <Ionicons
                      name={MODE_META[m.mode].icon as never}
                      size={15}
                      color={MODE_META[m.mode].gradient[0]}
                    />
                  }
                  gradient={MODE_META[m.mode].gradient}
                  stars={m.stars}
                  mastered={m.mastered}
                  total={m.total}
                  onPress={() =>
                    router.push({ pathname: '/game/setup', params: { mode: m.mode } })
                  }
                />
              ))}
            </View>

            <View style={styles.miniStats}>
              <MiniStat value={`${mastered}`} label="estrellas dominadas" color={colors.warning} />
              <View style={styles.divider} />
              <MiniStat
                value={`${Math.round(accuracy * 100)}%`}
                label="precisión global"
                color={colors.secondary}
              />
              <View style={styles.divider} />
              <MiniStat
                value={`${TOTAL_COUNTRIES}`}
                label="países en juego"
                color={colors.accent}
              />
            </View>
          </GlassCard>
        </Reveal>

        {/* Modos de juego */}
        <Reveal delay={200}>
          <Text style={[type.h2, { color: colors.text, marginTop: 4 }]}>Modos de juego</Text>
        </Reveal>

        <View style={styles.grid}>
          {MODES.map((mode, i) => (
            <Reveal key={mode} delay={240 + i * 60} from="scale" style={styles.gridItem}>
              <ModeCard mode={mode} onPress={() => router.push({ pathname: '/game/setup', params: { mode } })} />
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MiniStat({ value, label, color = colors.primary }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type.h3, { color }]}>{value}</Text>
      <Text style={[type.small, { color: colors.textFaint, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function ModeCard({ mode, onPress }: { mode: GameMode; onPress: () => void }) {
  const meta = MODE_META[mode];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.modeCard, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${meta.subtitle}`}
    >
      <LinearGradient
        colors={[`${meta.gradient[0]}2E`, `${meta.gradient[1]}12`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.modeIcon, { backgroundColor: `${meta.gradient[0]}26` }]}>
        <Ionicons name={meta.icon as never} size={20} color={meta.gradient[0]} />
      </View>
      <Text style={[type.h3, { color: colors.text, marginTop: 12 }]}>{meta.title}</Text>
      <Text style={[type.small, { color: colors.textDim, marginTop: 2 }]} numberOfLines={2}>
        {meta.subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeCard: {
    height: 300,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#05060F',
    justifyContent: 'flex-end',
  },
  globeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankSide: { flex: 1, alignItems: 'flex-end', paddingLeft: spacing.md },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  miniStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 4 },
  divider: { width: 1, height: 30, backgroundColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '47.6%', flexGrow: 1 },
  modeCard: {
    height: 150,
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  modeIcon: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
