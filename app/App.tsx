import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Notice, api } from './src/api';
import { AuthProvider, useAuth } from './src/auth';
import { BellIcon } from './src/icons';
import { onNotificationOpened, registerForPush } from './src/push';
import { LoginScreen, PendingScreen, ProfileScreen } from './src/screens/Login';
import { BookScreen, HomeScreen, ImportantNotices, InboxScreen, InfoPageScreen, PayScreen, SignupScreen } from './src/screens/Participant';
import { PushScreen, RegistrationsScreen, RosterScreen, TrainerPayScreen } from './src/screens/Trainer';
import { colors } from './src/theme';
import { ToastProvider } from './src/toast';

type Role = 'deltagare' | 'tränare';

const TABS: Record<Role, { key: string; label: string; Screen: React.ComponentType }[]> = {
  deltagare: [
    { key: 'home', label: 'Hem', Screen: HomeScreen },
    { key: 'book', label: 'Boka', Screen: BookScreen },
    { key: 'signup', label: 'Anmälan', Screen: SignupScreen },
    { key: 'pay', label: 'Betala', Screen: PayScreen },
  ],
  tränare: [
    { key: 'roster', label: 'Pass', Screen: RosterScreen },
    { key: 'regs', label: 'Anmälningar', Screen: RegistrationsScreen },
    { key: 'push', label: 'Skicka', Screen: PushScreen },
    { key: 'tpay', label: 'Betalningar', Screen: TrainerPayScreen },
  ],
};

function Logo() {
  return (
    <View style={styles.logo}>
      <Text style={styles.logoStark}>STARK</Text>
      <Text style={styles.logoMamma}>mamma</Text>
    </View>
  );
}

/** Registrerar mobilen för pushnotiser och öppnar rätt notis när man trycker på en. */
function usePush(onOpen: (noticeId: string | undefined) => void) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    registerForPush()
      .then((token) => token && api('push-token', { method: 'POST', body: { token, kind: 'expo' } }))
      .catch(() => {});
    return onNotificationOpened(onOpen);
  }, [onOpen]);
}

function Shell({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const tabs = TABS[role];
  const [tab, setTab] = useState(tabs[0].key);
  const [view, setView] = useState<'tabs' | 'inbox' | 'info'>('tabs');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [openNotice, setOpenNotice] = useState<Notice | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const unread = notices.filter((n) => !n.read || (n.requires_ack && !n.acknowledged)).length;

  const loadNotices = useCallback(
    () => api<{ notices: Notice[] }>('my-notices').then((r) => setNotices(r.notices)).catch(() => {}),
    [],
  );
  useEffect(() => {
    if (role !== 'deltagare') return;
    loadNotices();
    const t = setInterval(loadNotices, 60000);
    return () => clearInterval(t);
  }, [role, loadNotices]);

  const toTop = () => scroll.current?.scrollTo({ y: 0, animated: false });
  const open = (n: Notice) => {
    api('my-notices', { method: 'POST', body: { id: n.id } }).catch(() => {});
    setNotices((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.page_heading) {
      setOpenNotice(n);
      setView('info');
    } else setView('inbox');
    toTop();
  };
  const ack = (n: Notice) => {
    api('my-notices', { method: 'POST', body: { id: n.id, acknowledge: true } }).catch(() => {});
    const done = { ...n, read: true, acknowledged: true };
    setNotices((all) => all.map((x) => (x.id === n.id ? done : x)));
    setOpenNotice((o) => (o?.id === n.id ? done : o));
  };
  const openInbox = () => {
    setView('inbox');
    toTop();
    // Notiser utan informationssida räknas som lästa när man öppnat listan.
    notices.filter((n) => !n.read && !n.page_heading).forEach((n) => api('my-notices', { method: 'POST', body: { id: n.id } }).catch(() => {}));
    setNotices((all) => all.map((x) => (x.page_heading ? x : { ...x, read: true })));
  };

  const onPushOpen = useCallback(
    async (id: string | undefined) => {
      const r = await api<{ notices: Notice[] }>('my-notices').catch(() => null);
      if (!r) return;
      setNotices(r.notices);
      const n = r.notices.find((x) => x.id === id);
      if (n) open(n);
      else setView('inbox');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  usePush(onPushOpen);

  const Screen = current.Screen;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Logo />
        {role === 'tränare' ? (
          <Pressable onPress={signOut} accessibilityRole="button" style={{ alignItems: 'flex-end' }}>
            <Text style={styles.adminLabel}>{user?.name.split(' ')[0]}</Text>
            <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>Logga ut</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={openInbox}
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notiser, ${unread} olästa` : 'Notiser'}
            style={[styles.bell, view !== 'tabs' && { backgroundColor: '#EAE5DF' }]}
          >
            <BellIcon size={24} />
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {view === 'info' && openNotice ? (
          <InfoPageScreen notice={openNotice} onBack={() => setView('inbox')} onAck={ack} />
        ) : view === 'inbox' ? (
          <InboxScreen notices={notices} onOpen={open} onAck={ack} />
        ) : (
          <>
            {role === 'deltagare' ? <ImportantNotices notices={notices} onOpen={open} onAck={ack} /> : null}
            <Screen key={tab} />
          </>
        )}
        {role === 'deltagare' && view === 'tabs' && current.key === 'home' ? (
          <Pressable onPress={signOut} accessibilityRole="button" style={{ alignSelf: 'center', padding: 16 }}>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Logga ut</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        <View style={{ flexDirection: 'row' }}>
          {tabs.map((t) => {
            const active = t.key === current.key && view === 'tabs';
            return (
              <Pressable key={t.key} onPress={() => { setTab(t.key); setView('tabs'); toTop(); }} style={styles.tab}>
                <View style={[styles.tabIndicator, active && { backgroundColor: colors.ink }]} />
                <Text style={[styles.tabLabel, active && { color: colors.ink, fontWeight: '800' }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

/** Väljer vy utifrån inloggningen: inloggning, profil, väntar på aktivering, deltagare eller Emma. */
function Gate() {
  const { user } = useAuth();
  if (user === undefined)
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Logo />
      </SafeAreaView>
    );
  if (!user)
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <LoginScreen />
        </ScrollView>
      </SafeAreaView>
    );
  if (user.needs_profile)
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <ProfileScreen />
        </ScrollView>
      </SafeAreaView>
    );
  if (user.role === 'trainer') return <Shell role="tränare" />;
  if (user.status !== 'active')
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <PendingScreen>
            <SignupScreen />
          </PendingScreen>
        </ScrollView>
      </SafeAreaView>
    );
  return <Shell role="deltagare" />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
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
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  adminLabel: { fontSize: 14, fontWeight: '700', color: colors.muted },
  content: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabBar: { borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: 0, paddingBottom: 12 },
  tabIndicator: { height: 3, width: 28, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 10 },
  tabLabel: { fontSize: 13, color: colors.muted },
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
