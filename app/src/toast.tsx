import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text } from 'react-native';
import { haptic, useReducedMotion } from './motion';
import { colors } from './theme';

type Toast = { title: string; body?: string } | null;
const Ctx = createContext<(t: { title: string; body?: string }) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  const native = Platform.OS !== 'web';
  useEffect(() => {
    if (!toast) return;
    v.setValue(reduce ? 1 : 0);
    if (!reduce) Animated.timing(v, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
    const t = setTimeout(() => {
      if (reduce) return setToast(null);
      Animated.timing(v, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => setToast(null));
    }, 4500);
    return () => clearTimeout(t);
  }, [toast, v, reduce, native]);
  const show = (t: { title: string; body?: string }) => {
    haptic(/gick inte|fel/i.test(t.title) ? 'warning' : 'success');
    setToast(t);
  };
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', bottom: 84, left: 16, right: 16, maxWidth: 528, alignSelf: 'center',
            opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <Pressable onPress={() => setToast(null)} style={{ backgroundColor: colors.ink, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{toast.title}</Text>
            {toast.body ? <Text style={{ color: '#eee', fontSize: 14, marginTop: 2 }}>{toast.body}</Text> : null}
          </Pressable>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
