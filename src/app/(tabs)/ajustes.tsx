import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../lib/auth';
import { useDb } from '../../lib/db';
import { signOutWithConfirm } from '../../lib/signOut';
import { syncNow, useSyncStatus } from '../../lib/sync';

function statusText(state: string, pending: number, lastSyncAt?: number, error?: string) {
  if (state === 'syncing') return 'Sincronizando…';
  if (state === 'offline') return `Sin conexión${pending ? ` · ${pending} cambios esperando para subir` : ''}`;
  if (state === 'error') return `No se pudo sincronizar: ${error}`;
  if (pending) return `${pending} cambios esperando para subir`;
  if (lastSyncAt) return `Sincronizado a las ${new Date(lastSyncAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  return 'Sincronizado';
}

export default function AjustesScreen() {
  const { session } = useAuth();
  const { state, lastSyncAt, error } = useSyncStatus();
  const pending = useDb((s) => Object.keys(s.sync.pending).length);
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    await signOutWithConfirm();
    setLeaving(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950 px-4 pt-4" edges={['bottom']}>
      <View className="gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <Text className="text-sm text-ink-400">Cuenta</Text>
        <Text className="text-base text-ink-100">{session?.user.email}</Text>

        <View className="flex-row items-center gap-3">
          <Text className={`flex-1 text-sm ${state === 'error' ? 'text-kurenai-300' : 'text-ink-400'}`}>{statusText(state, pending, lastSyncAt, error)}</Text>
          <Pressable onPress={() => void syncNow()} disabled={state === 'syncing'} className="rounded-lg border border-ink-700 px-3 py-2">
            <Text className="text-sm text-ink-200">Sincronizar</Text>
          </Pressable>
        </View>

        <Pressable onPress={signOut} disabled={leaving} className="self-start rounded-lg border border-ink-700 px-4 py-2.5">
          {leaving ? <ActivityIndicator color="#c98a7c" /> : <Text className="text-sm font-medium text-kurenai-300">Cerrar sesión</Text>}
        </Pressable>
      </View>
      <Text className="mt-6 text-sm text-ink-500">Exportar / importar datos — próximo paso.</Text>
    </SafeAreaView>
  );
}
