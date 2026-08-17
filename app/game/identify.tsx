import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ProgressBar } from '@/components/Meters';
import { OptionButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { countries, type Country } from '@/data/countries';
import { Globe, type GlobeHandle, type GlobeMarker } from '@/globe/Globe';
import { formatDistance, haversine } from '@/lib/geo';
import { buildQuiz, MODE_META, scoreAnswer, type Question } from '@/lib/quiz';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colors, radius, spacing, type } from '@/theme/theme';

/** Color del punto que hay que identificar, antes de responder. */
const TARGET = '#A3E635';
const RIGHT = '#34D399';
const WRONG = '#FB7185';

/** Los 195 países, siempre en el globo: los vecinos son parte de la pregunta. */
const ALL_PINS = countries.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));

const FLY_MS = 900;

/**
 * Distancia al país más cercano, en km.
 *
 * Sirve para decidir cuánto acerca la cámara. Se calcula a demanda y se guarda:
 * son 194 haversines por país, y una ronda solo pregunta por una docena.
 */
const nearestNeighbour = new Map<string, number>();

function crowdingKm(c: Country): number {
  const cached = nearestNeighbour.get(c.id);
  if (cached !== undefined) return cached;

  let best = Infinity;
  for (const other of countries) {
    if (other.id === c.id) continue;
    const d = haversine(c, other);
    if (d < best) best = d;
  }
  nearestNeighbour.set(c.id, best);
  return best;
}

/**
 * A qué distancia se planta la cámara. Recuerda que en el globo **menos es más
 * cerca**: es la distancia del ojo al centro del planeta.
 *
 * Por defecto se queda lejos a propósito. Identificar un punto es un ejercicio
 * de posición relativa —Uruguay se distingue de Paraguay por dónde cae respecto
 * a Brasil y Argentina—, así que enseñar la región entera no es una concesión,
 * es el ejercicio. Solo se acerca con los micro-Estados, donde a esa altura el
 * punto resaltado y el de su vecino se solapan y la pregunta sería ilegible.
 */
function zoomFor(c: Country): number {
  return crowdingKm(c) < 400 ? 2.3 : 2.9;
}

export default function Identify() {
  const router = useRouter();
  const { region, length } = useSession();
  const begin = useSession((s) => s.begin);
  const push = useSession((s) => s.push);
  const streak = useSession((s) => s.streak);
  const registerAnswer = useProgress((s) => s.registerAnswer);

  const globe = React.useRef<GlobeHandle>(null);
  const [questions] = React.useState<Question[]>(() =>
    buildQuiz({
      mode: 'locateReverse',
      region,
      length,
      stats: useProgress.getState().stats,
    })
  );
  const [index, setIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<Country | null>(null);
  const askedAt = React.useRef(Date.now());
  const shake = useSharedValue(0);

  const meta = MODE_META.locateReverse;
  const q = questions[index];
  const target = q?.target;
  const first = questions[0]?.target;

  React.useEffect(() => {
    begin();
  }, [begin]);

  React.useEffect(() => {
    if (!target) return;
    setPicked(null);

    // La primera pregunta ya nace encuadrada (ver `initial`); a partir de ahí la
    // cámara viaja. El cronómetro se adelanta el tiempo del vuelo para no cobrar
    // como lentitud lo que es una animación.
    if (index === 0) {
      askedAt.current = Date.now();
      return;
    }
    globe.current?.flyTo(target.lat, target.lng, { zoom: zoomFor(target), duration: FLY_MS });
    askedAt.current = Date.now() + FLY_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const answer = (choice: Country) => {
    if (picked || !target) return;

    // Puede ser negativo si responden mientras la cámara aún vuela.
    const ms = Math.max(0, Date.now() - askedAt.current);
    const correct = choice.id === target.id;
    setPicked(choice);

    const gain = registerAnswer(target.id, 'locateReverse', correct);
    push({
      countryId: target.id,
      correct,
      given: choice.id,
      distanceKm: haversine(choice, target),
      points: scoreAnswer({
        correct,
        msElapsed: ms,
        streak,
        difficulty: target.difficulty,
        mode: 'locateReverse',
      }),
      ms,
      newStar: gain.newStar,
      newMastered: gain.newMastered,
    });

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withSpring(0, { damping: 12 })
      );
    }

    // Al fallar se da más tiempo: el punto rojo del país elegido aparece en el
    // globo y merece la pena mirarlo antes de pasar.
    setTimeout(
      () => {
        if (index + 1 >= questions.length) router.replace('/game/results');
        else setIndex((i) => i + 1);
      },
      correct ? 700 : 1800
    );
  };

  // Antes de responder solo brilla el objetivo. Después se pinta el veredicto:
  // verde el correcto y rojo el elegido, que casi siempre es un vecino y por
  // tanto está a la vista.
  const pinColors = React.useMemo<Record<string, string>>(() => {
    if (!target) return {};
    if (!picked) return { [target.id]: TARGET };
    const map: Record<string, string> = { [target.id]: RIGHT };
    if (picked.id !== target.id) map[picked.id] = WRONG;
    return map;
  }, [target, picked]);

  const markers = React.useMemo<GlobeMarker[]>(
    () =>
      target && !picked
        ? [{ id: target.id, lat: target.lat, lng: target.lng, color: TARGET, kind: 'pulse' as const }]
        : [],
    [target, picked]
  );

  if (!target || !first) return null;

  const correct = picked?.id === target.id;
  const stateFor = (option: Country) => {
    if (!picked) return 'idle' as const;
    if (option.id === target.id) return 'correct' as const;
    if (option.id === picked.id) return 'wrong' as const;
    return 'muted' as const;
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.root}>
        <View style={styles.globeWrap}>
          <Globe
            ref={globe}
            style={StyleSheet.absoluteFill}
            autoRotate={false}
            interactive
            pins={ALL_PINS}
            pinColors={pinColors}
            markers={markers}
            initial={{ lat: first.lat, lng: first.lng, zoom: zoomFor(first) }}
          />

          <LinearGradient
            colors={['rgba(5,6,15,0.92)', 'rgba(5,6,15,0.35)', 'transparent']}
            style={styles.topFade}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(5,6,15,0.95)']}
            style={styles.bottomFade}
            pointerEvents="none"
          />

          <View style={styles.header}>
            <Pressable
              onPress={() => router.replace('/')}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Salir de la partida"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[type.label, { color: colors.textFaint }]}>
                {index + 1} / {questions.length}
              </Text>
              <ProgressBar ratio={index / questions.length} gradient={meta.gradient} />
            </View>
            <View style={styles.streakBadge}>
              <Ionicons name="flash" size={13} color={colors.warning} />
              <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.panel, shakeStyle]}>
          <View style={styles.promptRow}>
            <View style={styles.dotSample} />
            <Text style={[type.label, { color: colors.textFaint, flex: 1 }]}>
              ¿QUÉ PAÍS ES EL PUNTO MARCADO?
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: spacing.md }}
          >
            {q.options.map((option, i) => (
              <Reveal key={`${index}-${option.id}`} delay={50 + i * 50} from="right">
                <OptionButton
                  label={option.nameEs}
                  sublabel={picked && option.id === target.id ? option.subregion : undefined}
                  state={stateFor(option)}
                  onPress={() => answer(option)}
                  disabled={!!picked}
                  leading={
                    <View style={styles.bullet}>
                      <Text style={[type.bodyStrong, { color: colors.textDim }]}>
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                  }
                />
              </Reveal>
            ))}
          </ScrollView>

          {picked && !correct && (
            <Reveal from="bottom">
              <View style={styles.correctionBar}>
                <Ionicons name="information-circle" size={18} color={colors.secondary} />
                <Text style={[type.small, { color: colors.textDim, flex: 1 }]}>
                  Ese punto es {target.nameEs}. {picked.nameEs} está a{' '}
                  {formatDistance(haversine(picked, target))}.
                </Text>
              </View>
            </Reveal>
          )}
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  globeWrap: { height: '46%', overflow: 'hidden' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
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
  panel: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotSample: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: TARGET,
    borderWidth: 1.5,
    borderColor: '#4A6B12',
  },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  correctionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
});
