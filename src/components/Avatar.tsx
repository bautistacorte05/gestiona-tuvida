import { Image, Text, View } from 'react-native';

import type { UserProfile } from '../lib/db';

/** Foto de perfil o, si no hay, las iniciales (del nombre y apellido, o del email). */
export default function Avatar({ profile, email, size }: { profile?: Partial<UserProfile>; email?: string; size: number }) {
  const initials = profile?.nombre ? `${profile.nombre[0]}${profile.apellido?.[0] ?? ''}` : (email ?? '').slice(0, 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className="items-center justify-center overflow-hidden bg-shu-500">
      {profile?.fotoUri ? (
        <Image source={{ uri: profile.fotoUri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size * 0.38 }} className="font-bold text-washi">
          {initials.toUpperCase()}
        </Text>
      )}
    </View>
  );
}
