// Inloggning: e-post och en engångskod, eller Google/Facebook (samma som i Emmas admin på datorn).
// Den som är ny fyller i namn och telefonnummer och väntar sedan på att Emma aktiverar kontot.
// Rollen kommer från servern: Emma är tränare och kommer till admin, alla andra är deltagare.
// I prototypen finns ingen server: koden är alltid 123456 och Emmas e-post ger tränarrollen.
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FacebookMark, GoogleMark } from '../icons';
import { colors } from '../theme';
import { Button, Card, H1, P } from '../ui';

export type Role = 'deltagare' | 'tränare';

const EMMA = 'starkmammavarberg@gmail.com';
const DEMO_CODE = '123456';

export function LoginScreen({ onDone }: { onDone: (role: Role) => void }) {
  const [newUser, setNewUser] = useState<{ name: string; email: string; via: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (pending) return <PendingScreen onActivated={() => onDone('deltagare')} />;
  if (newUser) return <ProfileScreen initialName={newUser.name} email={newUser.email} via={newUser.via} onDone={() => setPending(true)} />;
  return <SignIn onTrainer={() => onDone('tränare')} onNew={setNewUser} />;
}

function SignIn({ onTrainer, onNew }: { onTrainer: () => void; onNew: (u: { name: string; email: string; via: string }) => void }) {
  const [who, setWho] = useState('');
  const [step, setStep] = useState<'who' | 'code'>('who');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: colors.card } as const;

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.trim());

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <View style={{ backgroundColor: colors.ink, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, transform: [{ skewX: '-8deg' }], marginBottom: 28 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontStyle: 'italic', fontSize: 28, letterSpacing: 1, lineHeight: 30 }}>STARK</Text>
        <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 13, textAlign: 'right', marginTop: -4 }}>mamma</Text>
      </View>

      {step === 'who' ? (
        <>
          <H1>Logga in</H1>
          <P muted style={{ marginBottom: 16 }}>Skriv din e-post så skickar vi en kod. Är du ny skapas ditt konto direkt.</P>
          <TextInput
            value={who}
            onChangeText={setWho}
            placeholder="E-post"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={input}
          />
          <Button title="Skicka kod" disabled={!valid} onPress={() => { setError(''); setStep('code'); }} style={{ marginTop: 14 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Text style={{ color: colors.muted }}>eller</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>
          {/* I den riktiga appen anropas signInWith('google' | 'facebook') i src/oauth.ts. */}
          <SocialButton label="Fortsätt med Google" mark={<GoogleMark />} onPress={() => onNew({ name: 'Sara Lind', email: 'sara.lind@gmail.com', via: 'Google' })} />
          <SocialButton label="Fortsätt med Facebook" mark={<FacebookMark />} onPress={() => onNew({ name: 'Sara Lind', email: 'sara.lind@gmail.com', via: 'Facebook' })} />
        </>
      ) : (
        <>
          <H1>Skriv koden</H1>
          <P muted style={{ marginBottom: 16 }}>Vi har skickat en kod med 6 siffror till {who.trim()}.</P>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.line}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={[input, { fontSize: 26, letterSpacing: 8, textAlign: 'center' }]}
          />
          {error ? <P style={{ color: colors.danger, marginTop: 8 }}>{error}</P> : null}
          <Button
            title="Logga in"
            disabled={code.length !== 6}
            onPress={() => {
              if (code !== DEMO_CODE) return setError('Fel kod. Försök igen.');
              if (who.trim().toLowerCase() === EMMA) onTrainer();
              else onNew({ name: '', email: who.trim(), via: 'e-post' });
            }}
            style={{ marginTop: 14 }}
          />
          <Button title="Byt e-postadress" variant="ghost" onPress={() => { setStep('who'); setCode(''); setError(''); }} />
        </>
      )}

      <Card style={{ marginTop: 28, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <P style={{ fontWeight: '700' }}>Prototyp</P>
        <P muted>Koden är alltid {DEMO_CODE}. Logga in med {EMMA} för att komma till Emmas admin. Alla andra adresser, och Google och Facebook, visar hur en ny deltagare registrerar sig.</P>
      </Card>
    </View>
  );
}

function SocialButton({ label, mark, onPress }: { label: string; mark: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
        borderRadius: 999,
        paddingVertical: 13,
        marginBottom: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {mark}
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const field = { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: colors.card, marginBottom: 12 } as const;

function ProfileScreen({ initialName, email, via, onDone }: { initialName: string; email: string; via: string; onDone: () => void }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const ok = name.trim().split(/\s+/).length >= 2 && phone.replace(/\D/g, '').length >= 8;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <H1>Välkommen!</H1>
      <P muted style={{ marginBottom: 18 }}>
        Du är inloggad med {email}
        {via !== 'e-post' ? ` via ${via}` : ''}. Fyll i ditt namn och mobilnummer så att Emma vet vem du är.
      </P>
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Namn</Text>
      <TextInput value={name} onChangeText={setName} placeholder="För- och efternamn" placeholderTextColor={colors.muted} autoComplete="name" style={field} />
      <Text style={{ fontWeight: '700', marginBottom: 6 }}>Mobilnummer</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="070-123 45 67" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel" style={field} />
      <Button title="Fortsätt" disabled={!ok} onPress={onDone} style={{ marginTop: 6 }} />
    </View>
  );
}

function PendingScreen({ onActivated }: { onActivated: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <H1>Tack!</H1>
      <P style={{ marginBottom: 10 }}>Ditt konto är skapat och väntar på att Emma aktiverar det.</P>
      <P muted>Du får en notis så fort det är klart. Sedan kan du se dina pass, lämna återbud och anmäla dig till nästa omgång.</P>
      <Card style={{ marginTop: 28, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <P style={{ fontWeight: '700' }}>Prototyp</P>
        <P muted style={{ marginBottom: 12 }}>I den riktiga appen aktiverar Emma kontot i admin.</P>
        <Button small title="Låtsas att Emma aktiverar kontot" onPress={onActivated} />
      </Card>
    </View>
  );
}
