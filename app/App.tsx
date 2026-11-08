import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BookScreen, HomeScreen, InboxScreen, PayScreen, SignupScreen } from './src/screens/Participant';
import { PushScreen, RegistrationsScreen, RosterScreen, TrainerPayScreen } from './src/screens/Trainer';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';

type Role = 'deltagare' | 'tränare';

const TABS: Record<Role, { key: string; label: string; icon: string; Screen: React.ComponentType }[]> = {
  deltagare: [
    { key: 'home', label: 'Hem', icon: '🏠', Screen: HomeScreen },
    { key: 'book', label: 'Boka', icon: '📅', Screen: BookScreen },
    { key: 'signup', label: 'Anmälan', icon: '🔥', Screen: SignupScreen },
    { key: 'pay', label: 'Betala', icon: '💳', Screen: PayScreen },
    { key: 'inbox', label: 'Notiser', icon: '🔔', Screen: InboxScreen },
  ],
  tränare: [
    { key: 'roster', label: 'Pass', icon: '🏋️', Screen: RosterScreen },
    { key: 'regs', label: 'Anmälningar', icon: '📝', Screen: RegistrationsScreen },
    { key: 'push', label: 'Skicka', icon: '📣', Screen: PushScreen },
    { key: 'tpay', label: 'Betalningar', icon: '💰', Screen: TrainerPayScreen },
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

function Shell() {
  const [role, setRole] = useState<Role>('deltagare');
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
        <View style={styles.roleSwitch}>
          {(['deltagare', 'tränare'] as Role[]).map((r) => (
            <Pressable key={r} onPress={() => go(r, tab[r])} style={[styles.roleBtn, role === r && styles.roleBtnActive]}>
              <Text style={[styles.roleText, role === r && { color: '#fff' }]}>{r === 'deltagare' ? 'Deltagare' : 'Tränare'}</Text>
            </Pressable>
          ))}
        </View>
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
                <Text style={{ fontSize: 20, opacity: active ? 1 : 0.5 }}>{t.icon}</Text>
                <Text style={[styles.tabLabel, active && { color: colors.ink, fontWeight: '800' }]}>{t.label}</Text>
                {t.key === 'inbox' && inbox.length > 1 ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <Toast />
      <PushBanner onOpen={() => go('deltagare', 'inbox')} />
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
  roleSwitch: { flexDirection: 'row', backgroundColor: '#EAE5DF', borderRadius: 999, padding: 3 },
  roleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  roleBtnActive: { backgroundColor: colors.accent },
  roleText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  content: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabBar: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  dot: { position: 'absolute', top: 6, right: '30%', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
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
