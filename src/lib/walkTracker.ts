import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { distanceKm } from './geo';
import { currentAccentColor } from './theme';

/**
 * Rastreo del paseo en vivo, también con la pantalla bloqueada.
 *
 * En la app instalada (APK/build) usa `startLocationUpdatesAsync` + una tarea en segundo plano:
 * en Android corre como servicio en primer plano con la notificación fija "Paseo en curso".
 * En Expo Go no existe el segundo plano: se usa `watchPositionAsync` (solo con la app abierta).
 *
 * El recorrido se guarda en un store persistente a medida que llega cada punto, así la pantalla
 * lo muestra completo al volver y no se pierde si la app se cierra de golpe.
 */

export type WalkPoint = { lat: number; lng: number; t: number };

type LiveWalk = {
  active: boolean;
  petId?: string;
  startedAt: number;
  path: WalkPoint[];
  distanceKm: number;
};

const EMPTY: LiveWalk = { active: false, startedAt: 0, path: [], distanceKm: 0 };

export const useLiveWalk = create<LiveWalk>()(
  persist(() => EMPTY, { name: 'gestion-squali-live-walk', storage: createJSONStorage(() => AsyncStorage) }),
);

const TASK = 'paseo-en-vivo';
// Lecturas con peor precisión que esto se descartan (en la calle, entre edificios, el GPS salta).
const MAX_ACCURACY_M = 35;
// Saltos imposibles caminando (> 15 m/s ≈ 54 km/h) también se descartan.
const MAX_SPEED_MS = 15;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const supportsBackground = Platform.OS !== 'web' && !isExpoGo;

function addPoints(locations: Location.LocationObject[]) {
  const walk = useLiveWalk.getState();
  if (!walk.active) return;
  let { path, distanceKm: total } = walk;
  for (const loc of locations) {
    if (loc.coords.accuracy != null && loc.coords.accuracy > MAX_ACCURACY_M) continue;
    const point = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp };
    const prev = path[path.length - 1];
    if (prev) {
      const km = distanceKm(prev, point);
      const seconds = Math.max(1, (point.t - prev.t) / 1000);
      if ((km * 1000) / seconds > MAX_SPEED_MS) continue;
      total += km;
    }
    path = [...path, point];
  }
  useLiveWalk.setState({ path, distanceKm: total });
}

// La tarea tiene que estar definida apenas carga la app (este módulo se importa desde el layout
// raíz): Android puede despertar la app en segundo plano solo para entregarle ubicaciones.
if (supportsBackground && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    // En segundo plano el store puede no haber terminado de cargar lo guardado todavía.
    if (!useLiveWalk.persist.hasHydrated()) await useLiveWalk.persist.rehydrate();
    addPoints(data.locations);
  });
}

let foregroundWatch: Location.LocationSubscription | null = null;

async function startUpdates() {
  if (supportsBackground) {
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000,
      distanceInterval: 5,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '🐾 Paseo en curso',
        notificationBody: 'Registrando el recorrido. Tocá para ver el mapa.',
        notificationColor: currentAccentColor(),
      },
    });
  } else {
    foregroundWatch?.remove();
    foregroundWatch = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 },
      (loc) => addPoints([loc]),
    );
  }
}

async function stopUpdates() {
  foregroundWatch?.remove();
  foregroundWatch = null;
  if (supportsBackground && (await Location.hasStartedLocationUpdatesAsync(TASK))) await Location.stopLocationUpdatesAsync(TASK);
}

/** Pide permiso de ubicación. Iniciado con la app abierta, Android e iOS siguen rastreando con la pantalla bloqueada sin "Permitir siempre". */
export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function startWalk(petId: string) {
  useLiveWalk.setState({ active: true, petId, startedAt: Date.now(), path: [], distanceKm: 0 });
  try {
    await startUpdates();
  } catch (e) {
    useLiveWalk.setState(EMPTY);
    throw e;
  }
}

/** Retoma un paseo que quedó a medias (por ejemplo, si la app se cerró del todo). */
export async function resumeWalk() {
  if (useLiveWalk.getState().active) await startUpdates();
}

/** ¿Hay un paseo guardado como activo pero sin rastreo andando? (la app se cerró en medio del paseo) */
export async function isWalkInterrupted() {
  if (!useLiveWalk.getState().active) return false;
  if (!supportsBackground) return !foregroundWatch;
  return !(await Location.hasStartedLocationUpdatesAsync(TASK));
}

/** Termina el paseo y devuelve lo recorrido (el guardado en la base lo hace la pantalla). */
export async function finishWalk() {
  await stopUpdates();
  const walk = useLiveWalk.getState();
  useLiveWalk.setState(EMPTY);
  return walk;
}
