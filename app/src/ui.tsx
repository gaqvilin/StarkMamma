import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radius } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function P({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: TextStyle }) {
  return <Text style={[styles.p, muted && { color: colors.muted }, style]}>{children}</Text>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const bg = { primary: colors.ink, secondary: colors.card, danger: colors.dangerSoft, ghost: 'transparent' }[variant];
  const fg = { primary: '#fff', secondary: colors.ink, danger: colors.danger, ghost: colors.accent }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

type Tone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const map: Record<Tone, [string, string]> = {
    ok: [colors.okSoft, colors.ok],
    warn: [colors.warnSoft, colors.warn],
    danger: [colors.dangerSoft, colors.danger],
    accent: [colors.accentSoft, colors.accent],
    neutral: ['#EEEAE5', colors.muted],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function Bar({ value, max, min }: { value: number; max: number; min?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = min && value < min ? colors.warn : value >= max ? colors.accent : colors.ok;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      {min ? <View style={[styles.barMin, { left: `${(min / max) * 100}%` }]} /> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.ink, borderColor: colors.ink }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, marginBottom: 4, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  p: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  btn: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontSize: 16, fontWeight: '700' },
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: '#EEEAE5', borderRadius: 4, overflow: 'visible', marginTop: 6 },
  barFill: { height: 8, borderRadius: 4 },
  barMin: { position: 'absolute', top: -3, width: 2, height: 14, backgroundColor: colors.ink },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
