import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/Meters';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { GAME_MODES, MODE_META, type GameMode } from '@/lib/quiz';
import {
  STARS_PER_MODE,
  TOTAL_STARS,
  countStars,
  rankForStars,
  selectModeProgress,
  useProgress,
} from '@/store/progress';
import { colors, radius, spacing, type } from '@/theme/theme';

/**
 * Pestaña de retos: los cuatro modos y nada más.
 *
 * El detalle del progreso vive en la pestaña Progreso; aquí solo queda una tira
 * con el rango y la racha, para saber dónde estás sin tener que desplazarse.
 */
export default function Quests() {
  const router = useRouter();
  const streak = useProgress((s) => s.streak);
  const stats = useProgress((s) => s.stats);

  const stars = countStars(stats);
  const rank = rankForStars(stars);
  const modes = selectModeProgress(stats);
  const starsByMode = React.useMemo(
    () => Object.fromEntries(modes.map((m) => [m.mode, m])),
    [modes]
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg }}
      >
        <Reveal from="top">
          <Text style={[type.label, { color: colors.primary }]}>ATLAS QUEST</Text>
          <Text
            style={[type.hero, { color: colors.text, marginTop: 4 }]}
            maxFontSizeMultiplier={1.3}
          >
            Elige tu reto
          </Text>
        </Reveal>

        {/* Tira de progreso: lo justo para ubicarte. */}
        <Reveal delay={60}>
          <Pressable
            onPress={() => router.push('/dashboard')}
            style={styles.rankStrip}
            accessibilityRole="button"
            accessibilityLabel={`${rank.title}. ${stars} de ${TOTAL_STARS} estrellas. Racha de ${streak} días. Ver progreso`}
          >
            <View style={styles.starBadge}>
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text style={[type.bodyStrong, { color: colors.warning }]}>{stars}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{rank.title}</Text>
              <Text style={[type.small, { color: colors.textFaint }]} numberOfLines={1}>
                {rank.next === null
                  ? 'Has coleccionado el mundo entero'
                  : `${rank.remaining} estrellas para el siguiente rango`}
              </Text>
            </View>

            {streak > 0 && (
              <View style={styles.streakChip}>
                <Ionicons name="flame" size={14} color={colors.warning} />
                <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        </Reveal>

        <View style={styles.grid}>
          {GAME_MODES.map((mode, i) => (
            <Reveal key={mode} delay={110 + i * 60} from="scale" style={styles.gridItem}>
              <QuestCard
                mode={mode}
                stars={starsByMode[mode]?.stars ?? 0}
                onPress={() => router.push({ pathname: '/game/setup', params: { mode } })}
              />
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuestCard({
  mode,
  stars,
  onPress,
}: {
  mode: GameMode;
  stars: number;
  onPress: () => void;
}) {
  const meta = MODE_META[mode];
  const ratio = stars / STARS_PER_MODE;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${meta.subtitle}. ${stars} de ${STARS_PER_MODE} estrellas`}
    >
      <LinearGradient
        colors={[`${meta.gradient[0]}2E`, `${meta.gradient[1]}12`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.cardIcon, { backgroundColor: `${meta.gradient[0]}26` }]}>
        <Ionicons name={meta.icon as never} size={19} color={meta.gradient[0]} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text style={[type.h3, { color: colors.text }]} maxFontSizeMultiplier={1.4}>
          {meta.title}
        </Text>
        <Text
          style={[type.small, { color: colors.textDim, marginTop: 2 }]}
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {meta.subtitle}
        </Text>

        <View style={{ marginTop: 12, gap: 5 }}>
          <ProgressBar ratio={ratio} height={5} gradient={meta.gradient} />
          <Text style={[type.label, { color: colors.textFaint }]}>
            {stars} / {STARS_PER_MODE} ★
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rankStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '47.6%', flexGrow: 1 },
  card: {
    // Con seis tarjetas hay que bajar de las 196 de cuando eran cuatro, o la
    // última fila se queda siempre fuera de pantalla.
    minHeight: 172,
    padding: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
