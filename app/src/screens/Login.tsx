// Inloggning: e-post och engångskod, eller Google/Facebook (samma som i Emmas admin på datorn).
// Den som är ny fyller i namn och mobilnummer och väntar sedan på att Emma aktiverar kontot.
// Rollen kommer från servern: Emma är tränare och får admin, alla andra är deltagare.
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { FacebookMark, GoogleMark } from '../icons';
import { signInWith } from '../oauth';
import { colors } from '../theme';
import { Button, H1, P } from '../ui';

const field = { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: colors.card } as const;
const page = { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' } as const;

function Logo() {
  return (
    <View style={{ backgroundColor: colors.ink, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, transform: [{ skewX: '-8deg' }], marginBottom: 28 }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontStyle: 'italic', fontSize: 28, letterSpacing: 1, lineHeight: 30 }}>STARK</Text>
      <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 13, textAlign: 'right', marginTop: -4 }}>mamma</Text>
    </View>
  );
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web') return; // Google/Facebook i appen kräver en riktig mobil
    api<{ providers: string[] }>('auth-providers').then((r) => setProviders(r.providers)).catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const social = (p: 'google' | 'facebook') =>
    run(async () => {
      const r = await signInWith(p);
      if ('token' in r) await signIn(r.token);
      else if ('error' in r) throw new Error(r.error);
    });

  return (
    <View style={page}>
      <Logo />
      {step === 'email' ? (
        <>
          <H1>Logga in</H1>
          <P muted style={{ marginBottom: 16 }}>Skriv din e-post så skickar vi en kod. Är du ny skapas ditt konto direkt.</P>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-post"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={field}
          />
          {error ? <P style={{ color: colors.danger, marginTop: 8 }}>{error}</P> : null}
          <Button
            title="Skicka kod"
            disabled={!valid || busy}
            onPress={() =>
              run(async () => {
                const r = await api<{ demoCode?: string }>('auth-start', { method: 'POST', body: { email: email.trim() } });
                setDemoCode(r.demoCode ?? '');
                setStep('code');
              })
            }
            style={{ marginTop: 14 }}
          />
          {providers.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                <Text style={{ color: colors.muted }}>eller</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
              </View>
              {providers.includes('google') && <SocialButton label="Fortsätt med Google" mark={<GoogleMark />} onPress={() => social('google')} />}
              {providers.includes('facebook') && <SocialButton label="Fortsätt med Facebook" mark={<FacebookMark />} onPress={() => social('facebook')} />}
            </>
          )}
        </>
      ) : (
        <>
          <H1>Skriv koden</H1>
          <P muted style={{ marginBottom: 16 }}>Vi har skickat en kod med 6 siffror till {email.trim()}.</P>
          {demoCode ? <P style={{ color: colors.accent, fontWeight: '700', marginBottom: 10 }}>Testläge: koden är {demoCode}</P> : null}
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.line}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={[field, { fontSize: 26, letterSpacing: 8, textAlign: 'center' }]}
          />
          {error ? <P style={{ color: colors.danger, marginTop: 8 }}>{error}</P> : null}
          <Button
            title="Logga in"
            disabled={code.length !== 6 || busy}
            onPress={() =>
              run(async () => {
                const r = await api<{ token: string }>('auth-verify', { method: 'POST', body: { email: email.trim(), code } });
                await signIn(r.token);
              })
            }
            style={{ marginTop: 14 }}
          />
          <Button title="Byt e-postadress" variant="ghost" onPress={() => { setStep('email'); setCode(''); setError(''); }} />
        </>
      )}
    </View>
  );
}

function SocialButton({ label, mark, onPress }: { label: string; mark: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.line,
        backgroundColor: colors.card, borderRadius: 999, paddingVertical: 13, marginBottom: 10, opacity: pressed ? 0.75 : 1,
      })}
    >
      {mark}
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

/** Ny person: fyll i namn och mobilnummer (namnet kan redan vara ifyllt från Google/Facebook). */
export function ProfileScreen() {
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [error, setError] = useState('');
  const ok = name.trim().split(/\s+/).length >= 2 && phone.replace(/\D/g, '').length >= 8;
  return (
    <View style={page}>
      <H1>Välkommen!</H1>
      <P muted style={{ marginBottom: 18 }}>Du är inloggad med {user?.email}. Fyll i ditt namn och mobilnummer så att Emma vet vem du är.</P>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Namn</Text>
      <TextInput value={name} onChangeText={setName} placeholder="För- och efternamn" placeholderTextColor={colors.muted} autoComplete="name" style={[field, { marginBottom: 12 }]} />
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Mobilnummer</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="070-123 45 67" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" style={[field, { marginBottom: 12 }]} />
      {error ? <P style={{ color: colors.danger, marginBottom: 8 }}>{error}</P> : null}
      <Button
        title="Fortsätt"
        disabled={!ok}
        onPress={async () => {
          setError('');
          try {
            await api('profile', { method: 'POST', body: { name, phone } });
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      <Button title="Logga ut" variant="ghost" onPress={signOut} />
    </View>
  );
}

/** Kontot väntar på Emma. Kollar automatiskt med jämna mellanrum. */
export function PendingScreen({ children }: { children?: React.ReactNode }) {
  const { refresh, signOut } = useAuth();
  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);
  return (
    <View style={[page, { justifyContent: 'flex-start', paddingTop: 48 }]}>
      <H1>Tack!</H1>
      <P style={{ marginBottom: 10 }}>Ditt konto är skapat och väntar på att Emma aktiverar det.</P>
      <P muted style={{ marginBottom: 16 }}>Du får en notis så fort det är klart. Om anmälan till en ny omgång är öppen kan du anmäla dig redan nu.</P>
      <Button small variant="secondary" title="Kolla igen" onPress={refresh} style={{ alignSelf: 'flex-start', marginBottom: 20 }} />
      {children}
      <Button title="Logga ut" variant="ghost" onPress={signOut} />
    </View>
  );
}
