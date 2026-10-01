import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { toISO } from '../lib/dates';
import { useDb } from '../lib/db';
import { formatDuration, formatPace } from '../lib/geo';
import { MAP_HTML } from '../lib/mapHtml';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { finishWalk, isWalkInterrupted, requestLocationPermission, resumeWalk, startWalk, supportsBackground, useLiveWalk } from '../lib/walkTracker';
import BackButton from './BackButton';
import PetSwitcher from './PetSwitcher';
import ScreenTitle from './ScreenTitle';

// Colores fijos (iguales en modo claro y oscuro): el botón rojo y su texto. El resto sale del tema.
const COLORS = {
  washi: '#ede3d3',
  shu: '#bf3b2e',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function PetWalkLiveView() {
  // En la PC no tiene sentido: no vas a salir a pasear con la computadora.
  // El GPS y el mapa (WebView) solo se activan en el celular.
  if (Platform.OS === 'web') return <PetWalkWebNotice />;
  return <PetWalkLiveViewNative />;
}

function PetWalkWebNotice() {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <BackButton />
        <ScreenTitle categoryId="mascota" subId="paseo-vivo" />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 40 }}>📵</Text>
        <Text style={[styles.hint, { fontSize: 15, color: styles.title.color, textAlign: 'center' }]}>Esta función es solo para el celular</Text>
        <Text style={styles.hint}>El paseo se rastrea con el GPS del celular. Abrí la app en tu celular para iniciar un paseo.</Text>
      </View>
    </SafeAreaView>
  );
}

function PetWalkLiveViewNative() {
  const styles = useStyles();
  const webRef = useRef<WebView>(null);
  /** Cuántos puntos del recorrido ya se dibujaron en el mapa. */
  const drawnRef = useRef(0);

  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const hasPets = petProfiles.some((p) => !p.archived);

  // El recorrido lo registra lib/walkTracker (también con la pantalla bloqueada); esta pantalla lo muestra.
  const walk = useLiveWalk();
  const [interrupted, setInterrupted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const tracking = walk.active && !interrupted;
  const elapsed = walk.active ? Math.max(0, now - walk.startedAt) : 0;

  useEffect(() => {
    if (!walk.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [walk.active]);

  // Al entrar: ¿quedó un paseo a medias porque la app se cerró del todo?
  useEffect(() => {
    void isWalkInterrupted().then(setInterrupted);
  }, []);

  // Mapa: al estar listo (o si el recorrido se reinició) se dibuja entero; después, solo lo nuevo.
  useEffect(() => {
    if (!mapReady) return;
    const path = walk.path;
    if (drawnRef.current === 0 || path.length < drawnRef.current) {
      webRef.current?.postMessage(JSON.stringify({ type: 'path', points: path }));
    } else {
      for (const p of path.slice(drawnRef.current)) webRef.current?.postMessage(JSON.stringify({ type: 'point', lat: p.lat, lng: p.lng }));
    }
    drawnRef.current = path.length;
  }, [mapReady, walk.path]);

  const start = async () => {
    if (!activePetId) {
      Alert.alert('Falta un dato', 'Primero elegí (o agregá) una mascota arriba para asociarle este paseo.');
      return;
    }
    if (!(await requestLocationPermission())) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    // Android 13+ necesita este permiso para mostrar la notificación fija del paseo.
    await Notifications.requestPermissionsAsync();
    setBusy(true);
    try {
      await startWalk(activePetId);
      setInterrupted(false);
      setNow(Date.now());
      if (!supportsBackground) {
        await Notifications.scheduleNotificationAsync({
          content: { title: '🐾 Paseo en curso', body: 'Rastreando el recorrido. Volvé a la app para ver el mapa.' },
          trigger: null,
        });
      }
    } catch (e) {
      Alert.alert('No se pudo iniciar el paseo', String((e as Error)?.message ?? e));
    }
    setBusy(false);
  };

  const resume = async () => {
    setBusy(true);
    try {
      await resumeWalk();
      setInterrupted(false);
    } catch (e) {
      Alert.alert('No se pudo retomar el paseo', String((e as Error)?.message ?? e));
    }
    setBusy(false);
  };

  const stop = async () => {
    setBusy(true);
    const done = await finishWalk();
    setInterrupted(false);
    setBusy(false);

    const endedAt = Date.now();
    const duration = endedAt - done.startedAt;
    if (done.petId) {
      const date = toISO(new Date(done.startedAt));
      useDb.getState().savePetWalk({ date, startedAt: done.startedAt, endedAt, distanceKm: done.distanceKm, path: done.path, petId: done.petId });
      const { checks, toggleCheck } = useDb.getState();
      if (!checks.some((c) => c.date === date && c.categoryId === 'mascota')) toggleCheck(date, 'mascota');
    }

    await Notifications.dismissAllNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: '✓ Paseo terminado', body: `${done.distanceKm.toFixed(2)} km en ${formatDuration(duration)}.` },
      trigger: null,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <BackButton />
        <ScreenTitle categoryId="mascota" subId="paseo-vivo" />
      </View>

      {!walk.active && hasPets && <PetSwitcher onAdd={() => addPetProfile({ nombre: '' })} />}
      {!walk.active && !hasPets && <Text style={styles.error}>⚠️ Primero cargá una mascota en Perfil / DNI.</Text>}

      {interrupted && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>El paseo quedó cortado (la app se cerró). Lo recorrido hasta ahí está guardado.</Text>
          <View style={styles.bannerRow}>
            <Pressable onPress={resume} disabled={busy} style={[styles.smallButton, { backgroundColor: COLORS.shu }]}>
              <Text style={styles.buttonText}>Continuar</Text>
            </Pressable>
            <Pressable onPress={stop} disabled={busy} style={[styles.smallButton, styles.outline]}>
              <Text style={styles.outlineText}>Guardar lo recorrido</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.mapWrap}>
        <WebView ref={webRef} source={{ html: MAP_HTML }} onLoadEnd={() => setMapReady(true)} style={styles.map} javaScriptEnabled />
        {!mapReady && (
          <View style={styles.mapLoading}>
            <Text style={styles.hint}>Cargando mapa…</Text>
          </View>
        )}
      </View>

      {permissionDenied && <Text style={styles.error}>⚠️ Sin permiso de ubicación no se puede registrar el paseo. Activalo en los ajustes del celular para esta app.</Text>}

      <View style={styles.statsRow}>
        <Stat label="Tiempo" value={formatDuration(elapsed)} />
        <Stat label="Distancia" value={`${walk.distanceKm.toFixed(2)} km`} />
        <Stat label="Ritmo" value={formatPace(elapsed / 60000, walk.distanceKm)} />
      </View>

      {tracking && (
        <Pressable onPress={stop} disabled={busy} style={[styles.button, { backgroundColor: COLORS.shu }]}>
          <Text style={styles.buttonText}>Finalizar paseo</Text>
        </Pressable>
      )}
      {!walk.active && (
        <Pressable onPress={start} disabled={busy} style={[styles.button, { backgroundColor: COLORS.shu }]}>
          <Text style={styles.buttonText}>▶ Iniciar paseo</Text>
        </Pressable>
      )}
      <Text style={styles.hint}>
        {supportsBackground
          ? 'Podés bloquear la pantalla o usar otras apps: el recorrido se sigue registrando. No cierres la app deslizándola.'
          : 'En Expo Go solo registra con la app abierta. En la app instalada sigue con la pantalla bloqueada.'}
      </Text>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c['ink-950'], padding: 16, gap: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    header: { gap: 2 },
    eyebrow: { color: '#d55181', fontSize: 13, fontWeight: '600' },
    title: { color: c['ink-100'], fontSize: 24, fontWeight: '700' },
    mapWrap: { height: 260, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c['ink-800'] },
    map: { flex: 1, backgroundColor: c['ink-950'] },
    mapLoading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
    error: { color: '#e07a6a', fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, backgroundColor: c['ink-900'], borderRadius: 14, borderWidth: 1, borderColor: c['ink-800'], alignItems: 'center', paddingVertical: 12 },
    statLabel: { color: c['ink-400'], fontSize: 12 },
    statValue: { color: c['ink-100'], fontSize: 18, fontWeight: '700', marginTop: 4 },
    button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    buttonText: { color: COLORS.washi, fontSize: 16, fontWeight: '700' },
    hint: { color: c['ink-400'], fontSize: 12, textAlign: 'center' },
    banner: { gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#b8934b66', backgroundColor: '#b8934b1a', padding: 12 },
    bannerText: { color: c['ink-100'], fontSize: 13 },
    bannerRow: { flexDirection: 'row', gap: 8 },
    smallButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    outline: { borderWidth: 1, borderColor: c['ink-700'] },
    outlineText: { color: c['ink-300'], fontSize: 14, fontWeight: '600' },
  });

function useStyles() {
  const c = useThemeColors();
  return useMemo(() => makeStyles(c), [c]);
}
