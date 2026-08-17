import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Flag } from '@/components/Flag';
import { GlassCard } from '@/components/GlassCard';
import { ProgressBar, ProgressRing, StarRow, StatPill } from '@/components/Meters';
import { GhostButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { byId, TOTAL_COUNTRIES } from '@/data/countries';
import { MODE_META } from '@/lib/quiz';
import {
  TOTAL_STARS,
  countMastered,
  countStars,
  rankForStars,
  selectAccuracy,
  selectComplete,
  selectModeProgress,
  selectRegionProgress,
  selectWeakest,
  useProgress,
} from '@/store/progress';
import { colors, gradients, radius, regionColors, regionGradients, spacing, type } from '@/theme/theme';

export default function Dashboard() {
  const router = useRouter();
  const { streak, bestStreak, stats, history, reset } = useProgress();

  const stars = countStars(stats);
  const mastered = countMastered(stats);
  const rank = rankForStars(stars);
  const modes = selectModeProgress(stats);
  const complete = selectComplete(stats).length;
  const accuracy = selectAccuracy(stats);
  const byRegion = selectRegionProgress(stats);
  const weakest = selectWeakest(stats, 8);

  const confirmReset = () =>
    Alert.alert(
      'Reiniciar progreso',
      'Se borrarán tus estrellas, tu racha y tus estadísticas. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: reset },
      ]
    );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg }}
      >
        {/* Sin botón de cerrar: es una pestaña, no una hoja modal. */}
        <Reveal from="top">
          <Text style={[type.label, { color: colors.primary }]}>TU PROGRESO</Text>
          <Text
            style={[type.h1, { color: colors.text, marginTop: 4 }]}
            maxFontSizeMultiplier={1.4}
          >
            {rank.title}
          </Text>
        </Reveal>

        <Reveal from="scale" delay={60}>
          <GlassCard padding={22} accent={gradients.aurora}>
            <View style={{ alignItems: 'center' }}>
              <ProgressRing ratio={stars / TOTAL_STARS} size={140} stroke={12} from="#FBBF24" to="#FB7185">
                <Text style={[type.hero, { color: colors.text }]}>{stars}</Text>
                <Text style={[type.label, { color: colors.textFaint }]}>ESTRELLAS</Text>
              </ProgressRing>
              <Text style={[type.small, { color: colors.textDim, textAlign: 'center', marginTop: 14 }]}>
                {rank.next === null
                  ? `Las ${TOTAL_STARS} estrellas del mundo`
                  : `${stars} de ${TOTAL_STARS} · ${rank.remaining} para el siguiente rango`}
              </Text>
            </View>
          </GlassCard>
        </Reveal>

        <Reveal delay={110}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatPill value={mastered} label="dominadas" color={colors.warning} />
            <StatPill value={streak} label="racha actual" color={colors.primary} />
            <StatPill value={bestStreak} label="mejor racha" color={colors.accent} />
          </View>
        </Reveal>

        <Reveal delay={160}>
          <GlassCard padding={18}>
            <Text style={[type.label, { color: colors.textFaint, marginBottom: 14 }]}>
              POR MODO
            </Text>
            <View style={{ gap: 14 }}>
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
            <Text style={[type.small, { color: colors.textFaint, marginTop: 14 }]}>
              Una estrella por país y modo: se gana al primer acierto y se rellena al dominarlo
              (3 aciertos con al menos 70 % de precisión). {complete} de {TOTAL_COUNTRIES} países
              tienen las seis. Precisión global: {Math.round(accuracy * 100)} %.
            </Text>
          </GlassCard>
        </Reveal>

        <Reveal delay={210}>
          <GlassCard padding={18}>
            <Text style={[type.label, { color: colors.textFaint, marginBottom: 14 }]}>
              POR CONTINENTE
            </Text>
            <View style={{ gap: 14 }}>
              {byRegion.map((r) => (
                <View key={r.region} style={{ gap: 6 }}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.bodyStrong, { color: colors.text }]}>{r.region}</Text>
                    <Text style={[type.small, { color: regionColors[r.region] ?? colors.primary }]}>
                      {r.stars}/{r.total}
                    </Text>
                  </View>
                  <ProgressBar
                    ratio={r.ratio}
                    height={6}
                    gradient={regionGradients[r.region] ?? gradients.aurora}
                  />
                </View>
              ))}
            </View>
          </GlassCard>
        </Reveal>

        {weakest.length > 0 && (
          <Reveal delay={260}>
            <GlassCard padding={18}>
              <Text style={[type.label, { color: colors.textFaint, marginBottom: 12 }]}>
                SIGUE PRACTICANDO
              </Text>
              <View style={styles.weakWrap}>
                {weakest.map((cid) => {
                  const c = byId[cid];
                  if (!c) return null;
                  return (
                    <Pressable
                      key={cid}
                      onPress={() => router.push({ pathname: '/country/[id]', params: { id: cid } })}
                      style={styles.weakChip}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.nameEs}. Ver ficha`}
                    >
                      <Flag id={c.id} width={26} rounded={5} />
                      <Text style={[type.small, { color: colors.text }]} numberOfLines={1}>
                        {c.nameEs}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </Reveal>
        )}

        {history.length > 0 && (
          <Reveal delay={310}>
            <GlassCard padding={18}>
              <Text style={[type.label, { color: colors.textFaint, marginBottom: 12 }]}>
                ÚLTIMAS PARTIDAS
              </Text>
              <View style={{ gap: 12 }}>
                {history.slice(0, 8).map((h, i) => {
                  const meta = MODE_META[h.mode];
                  const ratio = h.correct / Math.max(1, h.total);
                  return (
                    <View key={`${h.at}-${i}`} style={styles.historyRow}>
                      <View style={[styles.historyIcon, { backgroundColor: `${meta.gradient[0]}22` }]}>
                        <Ionicons name={meta.icon as never} size={15} color={meta.gradient[0]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyStrong, { color: colors.text }]}>
                          {meta.title} · {h.region ?? 'Mundo'}
                        </Text>
                        <Text style={[type.small, { color: colors.textFaint }]}>
                          {h.correct}/{h.total} aciertos · {h.points} pts
                          {h.stars > 0 ? ` · +${h.stars} ★` : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          type.bodyStrong,
                          { color: ratio >= 0.7 ? colors.success : colors.textDim },
                        ]}
                      >
                        {Math.round(ratio * 100)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>
          </Reveal>
        )}

        <Reveal delay={360}>
          <GhostButton
            label="Reiniciar progreso"
            onPress={confirmReset}
            icon={<Ionicons name="trash-outline" size={17} color={colors.danger} />}
          />
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weakWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,113,133,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.28)',
    maxWidth: 170,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
