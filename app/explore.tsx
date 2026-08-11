import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Flag } from '@/components/Flag';
import { Chip } from '@/components/Pressables';
import { Screen } from '@/components/Screen';
import {
  countries,
  formatPopulation,
  normalize,
  regions,
  type Country,
} from '@/data/countries';
import { Globe, type GlobeHandle, type GlobeMarker } from '@/globe/Globe';
import { countryNear } from '@/lib/locate';
import { isMastered, useProgress } from '@/store/progress';
import { colors, radius, regionColors, spacing, type } from '@/theme/theme';

export default function Explore() {
  const router = useRouter();
  const globe = React.useRef<GlobeHandle>(null);
  const stats = useProgress((s) => s.stats);

  const [query, setQuery] = React.useState('');
  const [region, setRegion] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Country | null>(null);

  const results = React.useMemo(() => {
    const q = normalize(query);
    return countries.filter((c) => {
      if (region && c.region !== region) return false;
      if (!q) return true;
      return (
        normalize(c.nameEs).includes(q) ||
        normalize(c.nameEn).includes(q) ||
        normalize(c.capital).includes(q)
      );
    });
  }, [query, region]);

  const markers = React.useMemo<GlobeMarker[]>(() => {
    if (!selected) return [];
    return [
      {
        id: selected.id,
        lat: selected.lat,
        lng: selected.lng,
        color: regionColors[selected.region] ?? '#2DD4BF',
        kind: 'pulse',
      },
    ];
  }, [selected]);

  const focus = (c: Country) => {
    setSelected(c);
    globe.current?.spin(false);
    globe.current?.flyTo(c.lat, c.lng, { zoom: 2.6, duration: 1100 });
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.globeWrap}>
        <Globe
          ref={globe}
          style={StyleSheet.absoluteFill}
          autoRotate={!selected}
          interactive
          markers={markers}
          initial={{ lat: 20, lng: 0, zoom: 3.2 }}
          onPickPoint={(p) => {
            // La rejilla de fronteras dice exactamente qué país hay bajo el dedo;
            // si el toque cae en mar abierto no cambiamos la selección.
            const hit = countryNear(p);
            if (hit) setSelected(hit);
          }}
        />
        <LinearGradient
          colors={['rgba(5,6,15,0.9)', 'transparent']}
          style={styles.topFade}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(5,6,15,0.95)']}
          style={styles.bottomFade}
          pointerEvents="none"
        />

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[type.h3, { color: colors.text, flex: 1 }]}>Explorar</Text>
        </View>

        {selected && (
          <Pressable
            onPress={() => router.push({ pathname: '/country/[id]', params: { id: selected.id } })}
            style={styles.selectedCard}
          >
            <Flag code={selected.code} emoji={selected.flag} width={52} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: colors.text }]} numberOfLines={1}>
                {selected.nameEs}
              </Text>
              <Text style={[type.small, { color: colors.textDim }]} numberOfLines={1}>
                {selected.capital} · {formatPopulation(selected.population)} hab.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Busca un país o capital…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={17} color={colors.textFaint} />
            </Pressable>
          )}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['Todos', ...regions]}
          keyExtractor={(r) => r}
          contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
          renderItem={({ item }) => (
            <Chip
              label={item}
              active={item === 'Todos' ? region === null : region === item}
              onPress={() => setRegion(item === 'Todos' ? null : item)}
              color={regionColors[item] ?? colors.primary}
            />
          )}
        />

        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          initialNumToRender={14}
          windowSize={9}
          renderItem={({ item }) => (
            <CountryRow
              country={item}
              mastered={isMastered(stats[item.id])}
              active={selected?.id === item.id}
              onPress={() => focus(item)}
              onOpen={() => router.push({ pathname: '/country/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <Text style={[type.body, { color: colors.textFaint, textAlign: 'center', marginTop: 30 }]}>
              Ningún país coincide con «{query}».
            </Text>
          }
        />
      </View>
    </Screen>
  );
}

function CountryRow({
  country,
  mastered,
  active,
  onPress,
  onOpen,
}: {
  country: Country;
  mastered: boolean;
  active: boolean;
  onPress: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onOpen}
      style={[styles.row, active && { borderColor: colors.primary, backgroundColor: 'rgba(45,212,191,0.10)' }]}
    >
      <Flag code={country.code} emoji={country.flag} width={44} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {country.nameEs}
          </Text>
          {mastered && <Ionicons name="checkmark-circle" size={14} color={colors.success} />}
        </View>
        <Text style={[type.small, { color: colors.textFaint }]} numberOfLines={1}>
          {country.capital} · {country.subregion}
        </Text>
      </View>
      <Pressable onPress={onOpen} hitSlop={10} style={styles.openBtn}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textDim} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  globeWrap: { height: '46%', overflow: 'hidden' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
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
  selectedCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(17,22,43,0.9)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  panel: { flex: 1, paddingHorizontal: spacing.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  openBtn: { padding: 4 },
});
