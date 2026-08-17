import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Flag } from '@/components/Flag';
import { GlassCard } from '@/components/GlassCard';
import { ProgressBar } from '@/components/Meters';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import {
  byId,
  formatArea,
  formatNumber,
  formatPopulation,
  formatYear,
  getCountry,
} from '@/data/countries';
import { Globe } from '@/globe/Globe';
import { MODE_META } from '@/lib/quiz';
import { GAME_MODES, starState, totalsForCountry, useProgress } from '@/store/progress';
import { colors, radius, regionColors, regionGradients, spacing, type } from '@/theme/theme';

export default function CountryDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const country = getCountry(id);
  const entry = useProgress((s) => s.stats[id ?? '']);
  const stat = totalsForCountry(entry);

  if (!country) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={[type.body, { color: colors.textDim }]}>País no encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const accent = regionColors[country.region] ?? colors.primary;
  const gradient = regionGradients[country.region] ?? ['#2DD4BF', '#38BDF8'];
  const accuracy = stat.seen > 0 ? stat.correct / stat.seen : 0;
  const stars = GAME_MODES.filter((m) => starState(entry?.[m]) !== 'none').length;

  const facts: { icon: string; label: string; value: string }[] = [
    { icon: 'business', label: 'Capital', value: country.capital },
    { icon: 'people', label: 'Población', value: `${formatPopulation(country.population)} hab.` },
    { icon: 'resize', label: 'Superficie', value: formatArea(country.area) },
    { icon: 'earth', label: 'Región', value: country.subregion },
    { icon: 'cash', label: 'Moneda', value: country.currency },
    { icon: 'chatbubbles', label: 'Idiomas', value: country.languages.join(', ') || '—' },
    { icon: 'person', label: 'Gentilicio', value: country.demonym },
  ];

  // `independence` y `founded` son excluyentes: los Estados que nunca fueron
  // dependencia de otro llevan fecha de fundación, no de independencia.
  if (country.independence)
    facts.push({ icon: 'flag', label: 'Independencia', value: formatYear(country.independence) });
  else if (country.founded)
    facts.push({ icon: 'flag', label: 'Fundación', value: formatYear(country.founded) });
  if (country.lifeExpectancy)
    facts.push({ icon: 'heart', label: 'Esperanza de vida', value: `${country.lifeExpectancy} años` });
  if (country.avgTemp != null)
    facts.push({ icon: 'thermometer', label: 'Temp. media', value: `${country.avgTemp} °C` });
  if (country.dish) facts.push({ icon: 'restaurant', label: 'Plato típico', value: country.dish });

  const neighbours = country.borders.map((b) => byId[b]).filter(Boolean);

  return (
    <Screen edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Cabecera con globo enfocado */}
        <View style={styles.hero}>
          <Globe
            style={StyleSheet.absoluteFill}
            autoRotate={false}
            interactive={false}
            quality="lite"
            initial={{ lat: country.lat, lng: country.lng, zoom: 2.55 }}
            markers={[
              { id: country.id, lat: country.lat, lng: country.lng, color: accent, kind: 'pulse' },
            ]}
          />
          <LinearGradient
            colors={['rgba(5,6,15,0.85)', 'transparent', 'rgba(5,6,15,0.98)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroTop}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.heroBottom}>
            <Flag id={country.id} name={country.nameEs} width={96} rounded={radius.md} />
            <Text
              style={[type.hero, { color: colors.text, marginTop: 14 }]}
              maxFontSizeMultiplier={1.4}
            >
              {country.nameEs}
            </Text>
            <Text style={[type.small, { color: colors.textDim }]}>{country.officialEs}</Text>
            <View style={[styles.regionTag, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
              <Text style={[type.small, { color: accent, fontFamily: 'Inter_600SemiBold' }]}>
                {country.region} · {country.subregion}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ padding: spacing.xl, gap: spacing.lg, marginTop: -8 }}>
          {/* Tus seis estrellas de este país, una por modo. */}
          {entry && stat.seen > 0 && (
            <Reveal>
              <GlassCard padding={16} accent={gradient}>
                <View style={styles.rowBetween}>
                  <Text style={[type.label, { color: colors.textFaint }]}>TUS ESTRELLAS</Text>
                  {stars === GAME_MODES.length && (
                    <View style={styles.masteredTag}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={[type.small, { color: colors.success }]}>Las seis</Text>
                    </View>
                  )}
                </View>

                <View style={styles.starGrid}>
                  {GAME_MODES.map((mode) => {
                    const state = starState(entry[mode]);
                    return (
                      <View key={mode} style={styles.starCell}>
                        <Ionicons
                          name={state === 'none' ? 'star-outline' : 'star'}
                          size={20}
                          // Ganada = ámbar tenue, dominada = ámbar pleno.
                          color={
                            state === 'mastered'
                              ? colors.warning
                              : state === 'earned'
                                ? 'rgba(251,191,36,0.5)'
                                : colors.textFaint
                          }
                        />
                        <Text
                          style={[type.label, { color: colors.textFaint, textAlign: 'center' }]}
                          numberOfLines={2}
                        >
                          {MODE_META[mode].title}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <ProgressBar ratio={accuracy} gradient={gradient} />
                  <Text style={[type.small, { color: colors.textDim }]}>
                    {stat.correct} aciertos de {stat.seen} intentos ({Math.round(accuracy * 100)} %)
                    · la estrella se rellena al dominar el modo
                  </Text>
                </View>
              </GlassCard>
            </Reveal>
          )}

          {/* Datos */}
          <Reveal delay={80}>
            <View style={styles.factGrid}>
              {facts.map((f) => (
                <View key={f.label} style={styles.fact}>
                  <View style={[styles.factIcon, { backgroundColor: `${accent}1F` }]}>
                    <Ionicons name={f.icon as never} size={15} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.label, { color: colors.textFaint }]}>
                      {f.label.toUpperCase()}
                    </Text>
                    <Text style={[type.bodyStrong, { color: colors.text, marginTop: 2 }]}>
                      {f.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          {/* Coordenadas */}
          <Reveal delay={130}>
            <GlassCard padding={16}>
              <Text style={[type.label, { color: colors.textFaint }]}>COORDENADAS</Text>
              <Text style={[type.h3, { color: colors.text, marginTop: 6 }]}>
                {Math.abs(country.lat).toFixed(2)}° {country.lat >= 0 ? 'N' : 'S'} ·{' '}
                {Math.abs(country.lng).toFixed(2)}° {country.lng >= 0 ? 'E' : 'O'}
              </Text>
              <Text style={[type.small, { color: colors.textFaint, marginTop: 4 }]}>
                {country.landlocked ? 'País sin salida al mar' : 'Con acceso al mar'} ·{' '}
                {formatNumber(country.borders.length)} fronteras terrestres
              </Text>
            </GlassCard>
          </Reveal>

          {/* Vecinos */}
          {neighbours.length > 0 && (
            <Reveal delay={180}>
              <Text style={[type.h3, { color: colors.text, marginBottom: 10 }]}>Países vecinos</Text>
              <View style={styles.neighbours}>
                {neighbours.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => router.push({ pathname: '/country/[id]', params: { id: n.id } })}
                    style={styles.neighbour}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.nameEs}. Ver ficha`}
                  >
                    <Flag id={n.id} width={30} rounded={6} />
                    <Text style={[type.small, { color: colors.text }]} numberOfLines={1}>
                      {n.nameEs}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Reveal>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 420, justifyContent: 'flex-end' },
  heroTop: { position: 'absolute', top: 56, left: spacing.lg },
  heroBottom: { alignItems: 'center', paddingBottom: spacing.xl, paddingHorizontal: spacing.xl },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  regionTag: {
    marginTop: 12,
    paddingHorizontal: 14,
    height: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  masteredTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Seis modos no caben en una fila sin machacar los rótulos: dos filas de tres.
  starGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 14 },
  starCell: { width: '33.33%', alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighbours: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  neighbour: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 190,
  },
});
