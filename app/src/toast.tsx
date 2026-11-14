import React, { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { colors } from './theme';

type Toast = { title: string; body?: string } | null;
const Ctx = createContext<(t: { title: string; body?: string }) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <Ctx.Provider value={setToast}>
      {children}
      {toast && (
        <Pressable
          onPress={() => setToast(null)}
          style={{ position: 'absolute', bottom: 84, left: 16, right: 16, maxWidth: 528, alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 14, padding: 14 }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{toast.title}</Text>
          {toast.body ? <Text style={{ color: '#eee', fontSize: 14, marginTop: 2 }}>{toast.body}</Text> : null}
        </Pressable>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
