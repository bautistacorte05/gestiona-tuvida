import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authErrorMessage } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError('');
    setInfo('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Completá email y contraseña.');
      return;
    }
    setBusy(true);
    if (mode === 'signIn') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (err) setError(authErrorMessage(err.message));
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (err) setError(authErrorMessage(err.message));
      else if (!data.session) {
        setInfo(`Te mandamos un mail a ${cleanEmail}. Abrí el link para confirmar la cuenta y después entrá acá.`);
        setMode('signIn');
        setPassword('');
      }
    }
    setBusy(false);
  };

  const switchMode = () => {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setError('');
    setInfo('');
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm gap-5">
          <View className="gap-1">
            <Text className="text-sm text-shu-400">Gestiona tu vida</Text>
            <Text className="text-3xl font-bold text-ink-100">{mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}</Text>
          </View>

          <View className="gap-3">
            <TextInput
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-3 text-base text-ink-100"
              placeholder="Email"
              placeholderTextColor="#877a61"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-3 text-base text-ink-100"
              placeholder={mode === 'signUp' ? 'Contraseña (mínimo 6 caracteres)' : 'Contraseña'}
              placeholderTextColor="#877a61"
              secureTextEntry
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
          </View>

          {!!error && <Text className="text-sm text-kurenai-300">{error}</Text>}
          {!!info && <Text className="text-sm text-moss-300">{info}</Text>}

          <Pressable onPress={submit} disabled={busy} className={`items-center rounded-lg bg-shu-500 py-3 ${busy ? 'opacity-60' : ''}`}>
            {busy ? <ActivityIndicator color="#ede3d3" /> : <Text className="font-semibold text-ink-100">{mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}</Text>}
          </Pressable>

          <Pressable onPress={switchMode} className="items-center py-2">
            <Text className="text-sm text-ink-400">
              {mode === 'signIn' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
              <Text className="text-shu-400">{mode === 'signIn' ? 'Crear una' : 'Entrar'}</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
