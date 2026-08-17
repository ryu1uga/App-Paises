import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { ProgressBar } from '@/components/Meters';
import { PrimaryButton } from '@/components/Pressables';
import { Reveal } from '@/components/Reveal';
import { Screen } from '@/components/Screen';
import { byId, countries, type Country } from '@/data/countries';
import { Globe, type GlobeHandle } from '@/globe/Globe';
import { formatDistance, haversine } from '@/lib/geo';
import { buildQuiz, scoreAnswer, type Question } from '@/lib/quiz';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colors, gradients, radius, spacing, type } from '@/theme/theme';

const SELECTED = '#38BDF8';
const RIGHT = '#34D399';
const WRONG = '#FB7185';

/** Los 195 países, siempre en el globo. Es constante, se calcula una vez. */
const ALL_PINS = countries.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));

export default function Locate() {
  const router = useRouter();
  const { region, length } = useSession();
  const begin = useSession((s) => s.begin);
  const push = useSession((s) => s.push);
  const streak = useSession((s) => s.streak);
  const registerAnswer = useProgress((s) => s.registerAnswer);

  const globe = React.useRef<GlobeHandle>(null);
  const [questions] = React.useState<Question[]>(() =>
    buildQuiz({ mode: 'locate', region, length, stats: useProgress.getState().stats })
  );
  const [index, setIndex] = React.useState(0);
  /** Marcador elegido pero aún sin confirmar. */
  const [selected, setSelected] = React.useState<Country | null>(null);
  /** Respuesta ya confirmada; a partir de aquí se revela el resultado. */
  const [picked, setPicked] = React.useState<Country | null>(null);
  const askedAt = React.useRef(Date.now());

  const q = questions[index];
  const target = q?.target;

  React.useEffect(() => {
    begin();
  }, [begin]);

  React.useEffect(() => {
    askedAt.current = Date.now();
    setSelected(null);
    setPicked(null);
    globe.current?.spin(false);
    // A propósito no movemos la cámara: encuadrar el país sería revelarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /** Primer paso: marcar un punto. Se puede cambiar tantas veces como haga falta. */
  const select = (countryId: string) => {
    if (picked) return;
    const choice = byId[countryId];
    if (!choice) return;
    void Haptics.selectionAsync();
    setSelected(choice);
  };

  /** Segundo paso: confirmar. Hasta aquí no se evalúa nada. */
  const confirm = () => {
    if (picked || !selected || !target) return;

    const ms = Date.now() - askedAt.current;
    const correct = selected.id === target.id;
    setPicked(selected);

    const gain = registerAnswer(target.id, 'locate', correct);
    push({
      countryId: target.id,
      correct,
      given: selected.id,
      distanceKm: haversine(selected, target),
      points: scoreAnswer({
        correct,
        msElapsed: ms,
        streak,
        difficulty: target.difficulty,
        mode: 'locate',
      }),
      ms,
      newStar: gain.newStar,
      newMastered: gain.newMastered,
    });

    void Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    if (!correct) globe.current?.flyTo(target.lat, target.lng, { duration: 1000 });
  };

  const next = () => {
    if (index + 1 >= questions.length) router.replace('/game/results');
    else setIndex((i) => i + 1);
  };

  // Antes de confirmar solo se resalta el punto elegido; ninguno delata la respuesta.
  const pinColors = React.useMemo<Record<string, string> | undefined>(() => {
    if (!picked) return selected ? { [selected.id]: SELECTED } : undefined;
    if (!target) return undefined;
    const map: Record<string, string> = { [target.id]: RIGHT };
    if (picked.id !== target.id) map[picked.id] = WRONG;
    return map;
  }, [selected, picked, target]);

  if (!target) return null;

  const correct = picked?.id === target.id;
  const distance = picked ? haversine(picked, target) : 0;

  return (
    <Screen edges={['top']}>
      <View style={styles.root}>
        <Globe
          ref={globe}
          style={StyleSheet.absoluteFill}
          autoRotate={false}
          interactive
          pins={ALL_PINS}
          pinColors={pinColors}
          onSelectPin={picked ? undefined : select}
          initial={{ lat: 20, lng: 0, zoom: 3.4 }}
        />

        <LinearGradient
          colors={['rgba(5,6,15,0.92)', 'rgba(5,6,15,0.35)', 'transparent']}
          style={styles.topFade}
          pointerEvents="none"
        />

        {/* Cabecera */}
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
            <ProgressBar ratio={index / questions.length} gradient={gradients.ocean} />
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flash" size={13} color={colors.warning} />
            <Text style={[type.bodyStrong, { color: colors.warning }]}>{streak}</Text>
          </View>
        </View>

        {/* Objetivo */}
        <Reveal trigger={index} from="top" style={styles.questionWrap}>
          <GlassCard padding={16} accent={gradients.ocean} borderRadius={radius.lg}>
            <Text style={[type.label, { color: colors.textFaint }]}>ENCUENTRA EL PUNTO DE</Text>
            <Text style={[type.h1, { color: colors.text, marginTop: 4 }]} maxFontSizeMultiplier={1.4}>
              {target.nameEs}
            </Text>
            <Text style={[type.small, { color: colors.textDim, marginTop: 2 }]}>
              {target.region} · {target.subregion}
            </Text>
          </GlassCard>
        </Reveal>

        {/* Panel inferior */}
        <View style={styles.bottom}>
          {!picked ? (
            <GlassCard padding={16} borderRadius={radius.xl}>
              <View style={styles.hintRow}>
                <View style={[styles.dotSample, !!selected && styles.dotSampleActive]} />
                <Text style={[type.small, { color: colors.textDim, flex: 1 }]}>
                  {selected
                    ? `Punto marcado en ${fmtCoord(selected)}. Toca otro si te has equivocado.`
                    : 'Cada punto es un país. Gira el globo, acércate y toca el que creas.'}
                </Text>
              </View>
              <PrimaryButton
                label={selected ? 'Confirmar respuesta' : 'Marca un punto primero'}
                gradient={gradients.ocean}
                onPress={confirm}
                disabled={!selected}
                style={{ marginTop: 14 }}
                icon={<Ionicons name="checkmark-circle" size={18} color="#04121A" />}
              />
            </GlassCard>
          ) : (
            <Reveal from="bottom">
              <GlassCard
                padding={18}
                borderRadius={radius.xl}
                accent={correct ? gradients.success : gradients.danger}
              >
                <View style={styles.resultRow}>
                  <View style={[styles.verdictIcon, correct ? styles.verdictOk : styles.verdictBad]}>
                    <Ionicons
                      name={correct ? 'checkmark' : 'close'}
                      size={26}
                      color={correct ? colors.success : colors.danger}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.h2, { color: correct ? colors.success : colors.danger }]}>
                      {correct ? '¡Correcto!' : 'Fallaste'}
                    </Text>
                    <Text style={[type.small, { color: colors.textDim, marginTop: 4 }]}>
                      {correct
                        ? `Ese punto es ${target.nameEs}.`
                        : `Elegiste ${picked.nameEs}, a ${formatDistance(distance)}. El punto verde es ${target.nameEs}.`}
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  label={index + 1 >= questions.length ? 'Ver resultados' : 'Siguiente país'}
                  gradient={gradients.ocean}
                  onPress={next}
                  style={{ marginTop: 16 }}
                  icon={<Ionicons name="arrow-forward" size={18} color="#04121A" />}
                />
              </GlassCard>
            </Reveal>
          )}
        </View>
      </View>
    </Screen>
  );
}

/** Coordenadas legibles, sin decir de qué país son. */
function fmtCoord(p: { lat: number; lng: number }): string {
  const ns = p.lat >= 0 ? 'N' : 'S';
  const ew = p.lng >= 0 ? 'E' : 'O';
  return `${Math.abs(p.lat).toFixed(1)}°${ns} ${Math.abs(p.lng).toFixed(1)}°${ew}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
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
  questionWrap: { marginTop: spacing.md, marginHorizontal: spacing.lg },
  bottom: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotSample: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#8A6410',
  },
  dotSampleActive: { backgroundColor: SELECTED, borderColor: '#17506E' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  verdictIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  verdictOk: { backgroundColor: 'rgba(52,211,153,0.14)', borderColor: 'rgba(52,211,153,0.45)' },
  verdictBad: { backgroundColor: 'rgba(251,113,133,0.14)', borderColor: 'rgba(251,113,133,0.45)' },
});
