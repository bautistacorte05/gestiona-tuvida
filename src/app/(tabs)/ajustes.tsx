import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '../../components/Avatar';
import DateField from '../../components/DateField';
import { useAuth } from '../../lib/auth';
import { formatDay } from '../../lib/dates';
import { useDb } from '../../lib/db';
import { pickAndResizeImage } from '../../lib/image';
import { signOutWithConfirm } from '../../lib/signOut';
import { syncNow, useSyncStatus } from '../../lib/sync';
import { ACCENTS, useAccent, useThemeColors } from '../../lib/theme';
import { useUiPrefs } from '../../lib/uiPrefs';

const INPUT = 'rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100';

function statusText(state: string, pending: number, lastSyncAt?: number, error?: string) {
  if (state === 'syncing') return 'Sincronizando…';
  if (state === 'offline') return `Sin conexión${pending ? ` · ${pending} cambios esperando para subir` : ''}`;
  if (state === 'error') return `No se pudo sincronizar: ${error}`;
  if (pending) return `${pending} cambios esperando para subir`;
  if (lastSyncAt) return `Sincronizado a las ${new Date(lastSyncAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  return 'Sincronizado';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-sm text-ink-400">{label}</Text>
      {children}
    </View>
  );
}

function ProfileCard() {
  const { session } = useAuth();
  const profile = useDb((s) => s.userProfile[0]);
  const updateUserProfile = useDb((s) => s.updateUserProfile);
  const c = useThemeColors();
  const email = session?.user.email ?? '';

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [nacimiento, setNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [foto, setFoto] = useState<string | undefined>();

  const startEdit = () => {
    setNombre(profile?.nombre ?? '');
    setApellido(profile?.apellido ?? '');
    setNacimiento(profile?.nacimiento ?? '');
    setTelefono(profile?.telefono ?? '');
    setCiudad(profile?.ciudad ?? '');
    setFoto(profile?.fotoUri);
    setEditing(true);
  };

  const pickPhoto = async () => {
    const uri = await pickAndResizeImage(400);
    if (uri) setFoto(uri);
  };

  const save = () => {
    updateUserProfile({
      nombre: nombre.trim() || undefined,
      apellido: apellido.trim() || undefined,
      nacimiento: nacimiento || undefined,
      telefono: telefono.trim() || undefined,
      ciudad: ciudad.trim() || undefined,
      fotoUri: foto,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <Text className="text-sm text-ink-400">Perfil</Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={pickPhoto}>
            <Avatar profile={{ nombre, apellido, fotoUri: foto }} email={email} size={72} />
          </Pressable>
          <View className="gap-2">
            <Pressable onPress={pickPhoto} className="rounded-lg border border-ink-700 px-4 py-2">
              <Text className="text-ink-300">{foto ? 'Cambiar foto' : 'Agregar foto'}</Text>
            </Pressable>
            {!!foto && (
              <Pressable onPress={() => setFoto(undefined)} className="px-1">
                <Text className="text-sm text-kurenai-300">Quitar foto</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View className="flex-row gap-2">
          <Field label="Nombre">
            <TextInput className={INPUT} placeholder="Ej: Lucía" placeholderTextColor={c['ink-500']} value={nombre} onChangeText={setNombre} autoComplete="given-name" />
          </Field>
          <Field label="Apellido">
            <TextInput className={INPUT} placeholder="Ej: Fernández" placeholderTextColor={c['ink-500']} value={apellido} onChangeText={setApellido} autoComplete="family-name" />
          </Field>
        </View>
        <View className="flex-row gap-2">
          <Field label="Nacimiento">
            <DateField value={nacimiento} onChange={setNacimiento} />
          </Field>
          <Field label="Teléfono">
            <TextInput
              className={INPUT}
              placeholder="Ej: 11 2345 6789"
              placeholderTextColor={c['ink-500']}
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
              autoComplete="tel"
            />
          </Field>
        </View>
        <Field label="Ciudad / país">
          <TextInput className={INPUT} placeholder="Ej: Buenos Aires, Argentina" placeholderTextColor={c['ink-500']} value={ciudad} onChangeText={setCiudad} />
        </Field>
        <View className="flex-row gap-2 pt-1">
          <Pressable onPress={() => setEditing(false)} className="items-center justify-center rounded-lg border border-ink-700 px-4 py-2.5">
            <Text className="text-ink-300">Cancelar</Text>
          </Pressable>
          <Pressable onPress={save} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
            <Text className="font-medium text-washi">Guardar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const fullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
  const details = [
    profile?.ciudad && `📍 ${profile.ciudad}`,
    profile?.telefono && `📞 ${profile.telefono}`,
    profile?.nacimiento && `🎂 ${formatDay(profile.nacimiento, { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].filter(Boolean) as string[];

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <Text className="text-sm text-ink-400">Perfil</Text>
      <View className="flex-row items-center gap-4">
        <Avatar profile={profile} email={email} size={72} />
        <View className="flex-1 gap-0.5">
          <Text className="text-xl font-bold text-ink-100">{fullName || 'Sin nombre'}</Text>
          <Text className="text-sm text-ink-400">{email}</Text>
          {details.map((d) => (
            <Text key={d} className="text-sm text-ink-300">
              {d}
            </Text>
          ))}
        </View>
      </View>
      <Pressable onPress={startEdit} className="self-start rounded-lg border border-ink-700 px-4 py-2.5">
        <Text className="text-sm text-ink-200">{fullName ? 'Editar perfil' : 'Completar perfil'}</Text>
      </Pressable>
    </View>
  );
}

const APPEARANCES = [
  { id: 'light', label: '☀️ Claro' },
  { id: 'dark', label: '🌙 Oscuro' },
  { id: 'system', label: '⚙️ Automático' },
] as const;

function AppearanceCard() {
  const appearance = useUiPrefs((s) => s.appearance);
  const setAppearance = useUiPrefs((s) => s.setAppearance);
  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <Text className="text-sm text-ink-400">Apariencia</Text>
      <View className="flex-row gap-2">
        {APPEARANCES.map((a) => {
          const active = appearance === a.id;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAppearance(a.id)}
              className={`flex-1 items-center rounded-lg border py-2.5 ${active ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}>
              <Text className={`text-sm ${active ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs text-ink-500">
        {appearance === 'system' ? 'Sigue el modo claro u oscuro de este dispositivo.' : 'Solo cambia en este dispositivo.'}
      </Text>
      <AccentPicker />
    </View>
  );
}

/** Color de la app: se guarda en el perfil de la cuenta, así es el mismo en el celular y en la PC. */
function AccentPicker() {
  const accent = useAccent();
  const updateUserProfile = useDb((s) => s.updateUserProfile);
  const c = useThemeColors();
  return (
    <View className="gap-2 border-t border-ink-800 pt-3">
      <Text className="text-sm text-ink-400">Color de la app</Text>
      <View className="flex-row flex-wrap gap-2">
        {ACCENTS.map((a) => {
          const active = accent === a.id;
          return (
            <Pressable
              key={a.id}
              // Tocar el que ya está elegido no hace nada: cada cambio vuelve a subir el perfil (con la foto).
              onPress={() => {
                if (!active) updateUserProfile({ accent: a.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={a.label}
              className="h-11 w-11 items-center justify-center rounded-full border-2"
              style={{ borderColor: active ? c['ink-100'] : 'transparent' }}>
              <View className="h-8 w-8 rounded-full" style={{ backgroundColor: a[500] }} />
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs text-ink-500">Se guarda en tu cuenta: es el mismo en el celular y en la PC.</Text>
    </View>
  );
}

function AccountCard() {
  const { state, lastSyncAt, error } = useSyncStatus();
  const pending = useDb((s) => Object.keys(s.sync.pending).length);
  const c = useThemeColors();
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    await signOutWithConfirm();
    setLeaving(false);
  };

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <Text className="text-sm text-ink-400">Cuenta</Text>
      <View className="flex-row items-center gap-3">
        <Text className={`flex-1 text-sm ${state === 'error' ? 'text-kurenai-300' : 'text-ink-300'}`}>{statusText(state, pending, lastSyncAt, error)}</Text>
        <Pressable onPress={() => void syncNow()} disabled={state === 'syncing'} className="rounded-lg border border-ink-700 px-3 py-2">
          <Text className="text-sm text-ink-200">Sincronizar</Text>
        </Pressable>
      </View>
      <Pressable onPress={signOut} disabled={leaving} className="self-start rounded-lg border border-ink-700 px-4 py-2.5">
        {leaving ? <ActivityIndicator color={c['shu-500']} /> : <Text className="text-sm font-medium text-kurenai-300">Cerrar sesión</Text>}
      </Pressable>
    </View>
  );
}

export default function AjustesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['bottom']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="mx-auto w-full max-w-2xl gap-4 pb-10 pt-4">
        <ProfileCard />
        <AppearanceCard />
        <AccountCard />
        <Text className="text-sm text-ink-500">Exportar / importar datos — próximo paso.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
