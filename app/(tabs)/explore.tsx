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
import { GAME_MODES, starsForCountry, useProgress } from '@/store/progress';
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

        {/* Sin botón de volver: es una pestaña, no una pantalla apilada. */}
        <View style={styles.header} pointerEvents="none">
          <Text style={[type.h2, { color: colors.text }]}>Explorar</Text>
          <Text style={[type.small, { color: colors.textDim }]}>
            Gira el planeta o busca en la lista
          </Text>
        </View>

        {selected && (
          <Pressable
            onPress={() => router.push({ pathname: '/country/[id]', params: { id: selected.id } })}
            style={styles.selectedCard}
            accessibilityRole="button"
            accessibilityLabel={`${selected.nameEs}. Capital ${selected.capital}. Ver ficha`}
          >
            <Flag id={selected.id} width={52} />
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
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Borrar la búsqueda"
            >
              <Ionicons name="close-circle" size={17} color={colors.textFaint} />
            </Pressable>
          )}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['Todos', ...regions]}
          keyExtractor={(r) => r}
          // Sin `flexGrow: 0` una lista horizontal se reparte el alto sobrante
          // con la de resultados en vez de ceñirse a sus chips.
          style={{ flexGrow: 0 }}
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
          // Sin `flex: 1` la lista crece con sus 195 filas y el panel le recorta
          // el final: las últimas quedaban fuera y sin manera de alcanzarlas.
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          initialNumToRender={14}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <CountryRow
              country={item}
              stars={starsForCountry(stats, item.id)}
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
  stars,
  active,
  onPress,
  onOpen,
}: {
  country: Country;
  /** Estrellas ganadas de las 4 posibles (una por modo). */
  stars: number;
  active: boolean;
  onPress: () => void;
  onOpen: () => void;
}) {
  const complete = stars === GAME_MODES.length;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${country.nameEs}. Capital ${country.capital}. ${stars} de ${GAME_MODES.length} estrellas`}
      accessibilityHint="Toca para centrarlo en el globo, mantén pulsado para ver su ficha"
      accessibilityState={{ selected: active }}
      style={[styles.row, active && { borderColor: colors.primary, backgroundColor: 'rgba(45,212,191,0.10)' }]}
    >
      <Flag id={country.id} width={44} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {country.nameEs}
          </Text>
          {complete ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          ) : (
            stars > 0 && (
              <View style={styles.starCount}>
                <Ionicons name="star" size={10} color={colors.warning} />
                <Text style={[type.label, { color: colors.warning }]}>{stars}</Text>
              </View>
            )
          )}
        </View>
        <Text style={[type.small, { color: colors.textFaint }]} numberOfLines={1}>
          {country.capital} · {country.subregion}
        </Text>
      </View>
      <Pressable
        onPress={onOpen}
        hitSlop={10}
        style={styles.openBtn}
        accessibilityRole="button"
        accessibilityLabel={`Ver ficha de ${country.nameEs}`}
      >
        <Ionicons name="information-circle-outline" size={18} color={colors.textDim} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  globeWrap: { height: '42%', overflow: 'hidden' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  starCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
});
