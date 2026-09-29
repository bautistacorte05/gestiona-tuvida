import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { toISO } from '../lib/dates';
import { useDb } from '../lib/db';
import { distanceKm, formatDuration, formatPace } from '../lib/geo';
import { MAP_HTML } from '../lib/mapHtml';
import PetSwitcher from './PetSwitcher';
import BackButton from './BackButton';

// Paleta "Shu no Michi", igual que la app web.
const COLORS = {
  ink950: '#16120f',
  ink900: '#1f1a16',
  ink800: '#2a2118',
  ink400: '#a6987c',
  washi: '#ede3d3',
  shu: '#bf3b2e',
  gold: '#b8934b',
  moss: '#4c7a52',
};

type Point = { lat: number; lng: number; t: number };

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
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <BackButton />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>🐾 Mascota</Text>
          <Text style={styles.title}>🛰️ Paseo en vivo</Text>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 40 }}>📵</Text>
        <Text style={[styles.hint, { fontSize: 15, color: COLORS.washi, textAlign: 'center' }]}>Esta función es solo para el celular</Text>
        <Text style={styles.hint}>El paseo se rastrea con el GPS del iPhone. Abrí la app en tu celular para iniciar un paseo.</Text>
      </View>
    </SafeAreaView>
  );
}

function PetWalkLiveViewNative() {
  const webRef = useRef<WebView>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const pathRef = useRef<Point[]>([]);
  const walkPetIdRef = useRef<string | undefined>(undefined);

  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const hasPets = petProfiles.some((p) => !p.archived);

  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [tracking, setTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!tracking) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [tracking, startedAt]);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status === 'granted' ? 'granted' : 'denied');
    return status === 'granted';
  };

  const start = async () => {
    if (!activePetId) {
      Alert.alert('Falta un dato', 'Primero elegí (o agregá) una mascota arriba para asociarle este paseo.');
      return;
    }
    let ok = permission === 'granted';
    if (!ok) ok = await requestPermission();
    if (!ok) return;

    walkPetIdRef.current = activePetId;
    pathRef.current = [];
    setDistance(0);
    setStartedAt(Date.now());
    setElapsed(0);
    webRef.current?.postMessage(JSON.stringify({ type: 'reset' }));

    await Notifications.requestPermissionsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: '🐾 Paseo en curso', body: 'Rastreando el recorrido. Volvé a la app para ver el mapa.' },
      trigger: null,
    });

    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 },
      (pos) => {
        const point: Point = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
        const prev = pathRef.current[pathRef.current.length - 1];
        if (prev) setDistance((d) => d + distanceKm(prev, point));
        pathRef.current = [...pathRef.current, point];
        webRef.current?.postMessage(JSON.stringify({ type: 'point', lat: point.lat, lng: point.lng }));
      },
    );
    setTracking(true);
  };

  const stop = async () => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);

    const endedAt = Date.now();
    const date = toISO(new Date(startedAt));
    const petId = walkPetIdRef.current;
    if (petId) {
      useDb.getState().savePetWalk({ date, startedAt, endedAt, distanceKm: distance, path: pathRef.current, petId });
      const { checks, toggleCheck } = useDb.getState();
      if (!checks.some((c) => c.date === date && c.categoryId === 'mascota')) toggleCheck(date, 'mascota');
    }

    await Notifications.dismissAllNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: '✓ Paseo terminado', body: `${distance.toFixed(2)} km en ${formatDuration(elapsed)}.` },
      trigger: null,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <BackButton />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>🐾 Mascota</Text>
          <Text style={styles.title}>🛰️ Paseo en vivo</Text>
        </View>
      </View>

      {!tracking && hasPets && (
        <PetSwitcher onAdd={() => addPetProfile({ nombre: '' })} />
      )}
      {!tracking && !hasPets && <Text style={styles.error}>⚠️ Primero cargá una mascota en Perfil / DNI.</Text>}

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          source={{ html: MAP_HTML }}
          onLoadEnd={() => setMapReady(true)}
          style={styles.map}
          javaScriptEnabled
        />
        {!mapReady && (
          <View style={styles.mapLoading}>
            <Text style={styles.hint}>Cargando mapa…</Text>
          </View>
        )}
      </View>

      {permission === 'denied' && (
        <Text style={styles.error}>⚠️ Le negaste el permiso de ubicación. Activalo en Ajustes del iPhone para esta app.</Text>
      )}

      <View style={styles.statsRow}>
        <Stat label="Tiempo" value={formatDuration(elapsed)} />
        <Stat label="Distancia" value={`${distance.toFixed(2)} km`} />
        <Stat label="Ritmo" value={formatPace(elapsed / 60000, distance)} />
      </View>

      {tracking ? (
        <Pressable onPress={stop} style={[styles.button, { backgroundColor: COLORS.shu }]}>
          <Text style={styles.buttonText}>Finalizar paseo</Text>
        </Pressable>
      ) : (
        <Pressable onPress={start} style={[styles.button, { backgroundColor: COLORS.shu }]}>
          <Text style={styles.buttonText}>▶ Iniciar paseo</Text>
        </Pressable>
      )}
      <Text style={styles.hint}>
        Prototipo: funciona con la app abierta. El rastreo con pantalla bloqueada es el próximo paso.
      </Text>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ink950, padding: 16, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { gap: 2 },
  eyebrow: { color: '#d55181', fontSize: 13, fontWeight: '600' },
  title: { color: COLORS.washi, fontSize: 24, fontWeight: '700' },
  mapWrap: { height: 260, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.ink800 },
  map: { flex: 1, backgroundColor: COLORS.ink950 },
  mapLoading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#e07a6a', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: COLORS.ink900, borderRadius: 14, borderWidth: 1, borderColor: COLORS.ink800, alignItems: 'center', paddingVertical: 12 },
  statLabel: { color: COLORS.ink400, fontSize: 12 },
  statValue: { color: COLORS.washi, fontSize: 18, fontWeight: '700', marginTop: 4 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: COLORS.washi, fontSize: 16, fontWeight: '700' },
  hint: { color: COLORS.ink400, fontSize: 12, textAlign: 'center' },
});
