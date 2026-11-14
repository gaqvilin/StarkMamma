// Inloggningsläge för hela appen: token, inloggad person och utloggning.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, api, loadToken, saveToken, setCurrentToken } from './api';

interface AuthCtx {
  user: User | null | undefined; // undefined = laddar
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User | null }>('me');
      setUser(r.user);
      if (!r.user) {
        setCurrentToken(null);
        await saveToken(null);
      }
    } catch {
      setUser((u) => (u === undefined ? null : u));
    }
  }, []);

  useEffect(() => {
    loadToken().then((t) => {
      setCurrentToken(t);
      if (t) refresh();
      else setUser(null);
    });
  }, [refresh]);

  const signIn = async (token: string) => {
    setCurrentToken(token);
    await saveToken(token);
    await refresh();
  };
  const signOut = async () => {
    setCurrentToken(null);
    await saveToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth utanför AuthProvider');
  return c;
}

/** Hämtar data från API:et och laddar om när `reload()` anropas. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    api<T>(path)
      .then((d) => alive && (setData(d), setError('')))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [path, n]);
  return { data, error, reload: () => setN((x) => x + 1) };
}
