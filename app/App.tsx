import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BookScreen, HomeScreen, InboxScreen, PayScreen, SignupScreen } from './src/screens/Participant';
import { PushScreen, RegistrationsScreen, RosterScreen, TrainerPayScreen } from './src/screens/Trainer';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';

type Role = 'deltagare' | 'tränare';

const TABS: Record<Role, { key: string; label: string; Screen: React.ComponentType }[]> = {
  deltagare: [
    { key: 'home', label: 'Hem', Screen: HomeScreen },
    { key: 'book', label: 'Boka', Screen: BookScreen },
    { key: 'signup', label: 'Anmälan', Screen: SignupScreen },
    { key: 'pay', label: 'Betala', Screen: PayScreen },
    { key: 'inbox', label: 'Notiser', Screen: InboxScreen },
  ],
  tränare: [
    { key: 'roster', label: 'Pass', Screen: RosterScreen },
    { key: 'regs', label: 'Anmälningar', Screen: RegistrationsScreen },
    { key: 'push', label: 'Skicka', Screen: PushScreen },
    { key: 'tpay', label: 'Betalningar', Screen: TrainerPayScreen },
  ],
};

function PushBanner({ onOpen }: { onOpen: () => void }) {
  const { banner, dispatch } = useStore();
  const y = useRef(new Animated.Value(-140)).current;
  useEffect(() => {
    if (!banner) return;
    y.setValue(-140);
    Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    const t = setTimeout(() => dispatch({ type: 'dismissBanner' }), 5000);
    return () => clearTimeout(t);
  }, [banner, dispatch, y]);
  if (!banner) return null;
  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: y }] }]}>
      <Pressable onPress={() => { dispatch({ type: 'dismissBanner' }); onOpen(); }}>
        <Text style={styles.bannerApp}>STARKMAMMA · nu</Text>
        <Text style={styles.bannerTitle}>{banner.title}</Text>
        <Text style={styles.bannerBody} numberOfLines={2}>{banner.body}</Text>
      </Pressable>
    </Animated.View>
  );
}

function Toast() {
  const { toast, dispatch } = useStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch({ type: 'dismissToast' }), 4500);
    return () => clearTimeout(t);
  }, [toast, dispatch]);
  if (!toast) return null;
  return (
    <Pressable onPress={() => dispatch({ type: 'dismissToast' })} style={styles.toast}>
      <Text style={styles.bannerTitle}>{toast.title}</Text>
      <Text style={styles.bannerBody}>{toast.body}</Text>
    </Pressable>
  );
}

// Det finns bara en tränare: Emma. I den riktiga appen avgörs vyn av vem som är inloggad.
// I prototypen öppnas Emmas vy genom att lägga till #emma i adressen.
const roleFromHash = (): Role =>
  typeof window !== 'undefined' && window.location?.hash === '#emma' ? 'tränare' : 'deltagare';

function Shell() {
  const [role, setRole] = useState<Role>(roleFromHash);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const onHash = () => setRole(roleFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [tab, setTab] = useState<Record<Role, string>>({ deltagare: 'home', tränare: 'roster' });
  const tabs = TABS[role];
  const current = tabs.find((t) => t.key === tab[role]) ?? tabs[0];
  const { Screen } = current;
  const scroll = useRef<ScrollViewInstance>(null);
  const { inbox } = useStore();

  const go = (r: Role, k: string) => {
    setRole(r);
    setTab((t) => ({ ...t, [r]: k }));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoStark}>STARK</Text>
          <Text style={styles.logoMamma}>mamma</Text>
        </View>
        {role === 'tränare' ? <Text style={styles.adminLabel}>Emma</Text> : null}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Screen />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        <View style={{ flexDirection: 'row' }}>
          {tabs.map((t) => {
            const active = t.key === current.key;
            return (
              <Pressable key={t.key} onPress={() => go(role, t.key)} style={styles.tab}>
                <View style={[styles.tabIndicator, active && { backgroundColor: colors.ink }]} />
                <Text style={[styles.tabLabel, active && { color: colors.ink, fontWeight: '800' }]}>{t.label}</Text>
                {t.key === 'inbox' && inbox.length > 1 ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <Toast />
      {role === 'deltagare' ? <PushBanner onOpen={() => go('deltagare', 'inbox')} /> : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  logo: { backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 3, transform: [{ skewX: '-8deg' }] },
  logoStark: { color: '#fff', fontWeight: '900', fontStyle: 'italic', fontSize: 20, letterSpacing: 1, lineHeight: 22 },
  logoMamma: { color: '#fff', fontStyle: 'italic', fontSize: 10, textAlign: 'right', marginTop: -3 },
  adminLabel: { fontSize: 14, fontWeight: '700', color: colors.muted },
  content: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabBar: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: 0, paddingBottom: 12 },
  tabIndicator: { height: 3, width: 28, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 10 },
  tabLabel: { fontSize: 13, color: colors.muted },
  dot: { position: 'absolute', top: 10, right: '30%', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  banner: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: 'rgba(30,30,30,0.96)',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toast: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    maxWidth: 528,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    padding: 14,
  },
  bannerApp: { color: '#bbb', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 3 },
  bannerBody: { color: '#eee', fontSize: 14, marginTop: 2 },
});
