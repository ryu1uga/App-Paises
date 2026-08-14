import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Chip, PrimaryButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { countriesOf, regions } from '@/data/countries';
import { MODE_META, type GameMode } from '@/lib/quiz';
import { useSession } from '@/store/session';
import { colors, radius, regionColors, spacing, type } from '@/theme/theme';

const LENGTHS = [8, 12, 20, 30];

export default function Setup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const configure = useSession((s) => s.configure);

  const [mode, setMode] = React.useState<GameMode>((params.mode as GameMode) ?? 'flags');
  const [region, setRegion] = React.useState<string | null>(null);
  const [length, setLength] = React.useState(12);

  const meta = MODE_META[mode];
  const available = countriesOf(region).length;
  const effectiveLength = Math.min(length, available);

  const start = () => {
    configure({ mode, region, length: effectiveLength });
    router.replace(mode === 'locate' ? '/game/locate' : '/game/play');
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: spacing.lg }}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={[type.label, { color: colors.textFaint }]}>NUEVA PARTIDA</Text>
          <View style={{ width: 40 }} />
        </View>

        <Reveal>
          <LinearGradient
            colors={[`${meta.gradient[0]}33`, `${meta.gradient[1]}11`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={[styles.heroIcon, { backgroundColor: `${meta.gradient[0]}2E` }]}>
              <Ionicons name={meta.icon as never} size={26} color={meta.gradient[0]} />
            </View>
            <Text style={[type.h1, { color: colors.text }]}>{meta.title}</Text>
            <Text style={[type.body, { color: colors.textDim }]}>{meta.subtitle}</Text>
          </LinearGradient>
        </Reveal>

        <Reveal delay={60}>
          <Section title="Modo">
            <View style={styles.wrap}>
              {(Object.keys(MODE_META) as GameMode[]).map((m) => (
                <Chip
                  key={m}
                  label={MODE_META[m].title}
                  active={mode === m}
                  onPress={() => setMode(m)}
                  color={MODE_META[m].gradient[0]}
                />
              ))}
            </View>
          </Section>
        </Reveal>

        <Reveal delay={110}>
          <Section title="Continente">
            <View style={styles.wrap}>
              <Chip label="Todo el mundo" active={region === null} onPress={() => setRegion(null)} />
              {regions.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  active={region === r}
                  onPress={() => setRegion(r)}
                  color={regionColors[r] ?? colors.primary}
                />
              ))}
            </View>
            <Text style={[type.small, { color: colors.textFaint, marginTop: 10 }]}>
              {available} países disponibles
            </Text>
          </Section>
        </Reveal>

        <Reveal delay={160}>
          <Section title="Preguntas">
            <View style={styles.wrap}>
              {LENGTHS.map((n) => (
                <Chip
                  key={n}
                  label={`${n}`}
                  active={length === n}
                  onPress={() => setLength(n)}
                  color={colors.accent}
                />
              ))}
            </View>
            {effectiveLength < length && (
              <Text style={[type.small, { color: colors.warning, marginTop: 10 }]}>
                Este continente solo tiene {available} países: la ronda será de {effectiveLength}.
              </Text>
            )}
          </Section>
        </Reveal>

        <Reveal delay={220}>
          <PrimaryButton
            label="Empezar"
            gradient={meta.gradient}
            onPress={start}
            icon={<Ionicons name="play" size={18} color="#04121A" />}
          />
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard padding={18}>
      <Text style={[type.label, { color: colors.textFaint, marginBottom: 12 }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </GlassCard>
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
  hero: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
