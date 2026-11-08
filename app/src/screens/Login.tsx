// Inloggning: mobilnummer eller e-post och en engångskod (samma som i Emmas admin på datorn).
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
  const [who, setWho] = useState('');
  const [step, setStep] = useState<'who' | 'code'>('who');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: colors.card } as const;

  const valid = who.includes('@') ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.trim()) : who.replace(/\D/g, '').length >= 8;

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <View style={{ backgroundColor: colors.ink, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, transform: [{ skewX: '-8deg' }], marginBottom: 28 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontStyle: 'italic', fontSize: 28, letterSpacing: 1, lineHeight: 30 }}>STARK</Text>
        <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 13, textAlign: 'right', marginTop: -4 }}>mamma</Text>
      </View>

      {step === 'who' ? (
        <>
          <H1>Logga in</H1>
          <P muted style={{ marginBottom: 16 }}>Skriv ditt mobilnummer eller din e-post så skickar vi en kod.</P>
          <TextInput
            value={who}
            onChangeText={setWho}
            placeholder="Mobilnummer eller e-post"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="username"
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
          <SocialButton label="Fortsätt med Google" mark={<GoogleMark />} onPress={() => onDone('deltagare')} />
          <SocialButton label="Fortsätt med Facebook" mark={<FacebookMark />} onPress={() => onDone('deltagare')} />
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
              onDone(who.trim().toLowerCase() === EMMA ? 'tränare' : 'deltagare');
            }}
            style={{ marginTop: 14 }}
          />
          <Button title="Byt nummer eller e-post" variant="ghost" onPress={() => { setStep('who'); setCode(''); setError(''); }} />
        </>
      )}

      <Card style={{ marginTop: 28, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
        <P style={{ fontWeight: '700' }}>Prototyp</P>
        <P muted>Koden är alltid {DEMO_CODE}. Logga in med {EMMA} för att komma till Emmas admin. Alla andra nummer och adresser, och Google och Facebook, loggar in som deltagaren Sara.</P>
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
