import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Mensajes de Supabase (en inglés) traducidos para los casos comunes.
export function authErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu casilla (y spam).';
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email.';
  if (m.includes('password should be at least')) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'Ese email no es válido.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Esperá un rato y probá de nuevo.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisá tu internet.';
  return message;
}
