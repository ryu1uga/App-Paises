import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Flag } from '@/components/Flag';
import { GlassCard } from '@/components/GlassCard';
import { ProgressBar, ProgressRing, StatPill } from '@/components/Meters';
import { GhostButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { byId, TOTAL_COUNTRIES } from '@/data/countries';
import { MODE_META } from '@/lib/quiz';
import {
  levelProgress,
  levelTitle,
  selectAccuracy,
  selectMastered,
  selectRegionProgress,
  selectWeakest,
  useProgress,
} from '@/store/progress';
import { colors, gradients, radius, regionColors, regionGradients, spacing, type } from '@/theme/theme';

export default function Profile() {
  const router = useRouter();
  const { xp, streak, bestStreak, stats, history, reset } = useProgress();

  const level = levelProgress(xp);
  const mastered = selectMastered(stats);
  const accuracy = selectAccuracy(stats);
  const byRegion = selectRegionProgress(stats);
  const weakest = selectWeakest(stats, 8);

  const confirmReset = () =>
    Alert.alert('Reiniciar progreso', 'Se borrarán tu XP, racha y estadísticas. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: reset },
    ]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 48, gap: spacing.lg }}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </Pressable>
          <Text style={[type.label, { color: colors.textFaint }]}>TU PROGRESO</Text>
          <View style={{ width: 40 }} />
        </View>

        <Reveal from="scale">
          <GlassCard padding={22} accent={gradients.aurora}>
            <View style={{ alignItems: 'center' }}>
              <ProgressRing ratio={level.ratio} size={140} stroke={12}>
                <Text style={[type.hero, { color: colors.text }]}>{level.level}</Text>
                <Text style={[type.label, { color: colors.textFaint }]}>NIVEL</Text>
              </ProgressRing>
              <Text style={[type.h2, { color: colors.text, marginTop: 14 }]}>
                {levelTitle(level.level)}
              </Text>
              <Text style={[type.small, { color: colors.textDim }]}>
                {level.current} / {level.needed} XP hacia el nivel {level.level + 1}
              </Text>
            </View>
          </GlassCard>
        </Reveal>

        <Reveal delay={80}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatPill value={xp} label="XP total" />
            <StatPill value={streak} label="racha actual" color={colors.warning} />
            <StatPill value={bestStreak} label="mejor racha" color={colors.accent} />
          </View>
        </Reveal>

        <Reveal delay={130}>
          <GlassCard padding={18}>
            <View style={styles.rowBetween}>
              <Text style={[type.h3, { color: colors.text }]}>Países dominados</Text>
              <Text style={[type.h3, { color: colors.primary }]}>
                {mastered.length}/{TOTAL_COUNTRIES}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <ProgressBar ratio={mastered.length / TOTAL_COUNTRIES} />
            </View>
            <Text style={[type.small, { color: colors.textFaint, marginTop: 8 }]}>
              Un país cuenta como dominado tras 3 aciertos con al menos 70 % de precisión.
              Precisión global: {Math.round(accuracy * 100)} %.
            </Text>
          </GlassCard>
        </Reveal>

        <Reveal delay={180}>
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
                      {r.mastered}/{r.total}
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
          <Reveal delay={230}>
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
                    >
                      <Flag code={c.code} emoji={c.flag} width={26} rounded={5} />
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
          <Reveal delay={280}>
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
                          {h.correct}/{h.total} aciertos · +{h.xp} XP
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

        <Reveal delay={330}>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
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
