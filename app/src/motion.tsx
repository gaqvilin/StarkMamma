// Mjuka rörelser: knappar som fjädrar, vyer som tonar in och lätt vibration vid viktiga tryck.
// Följer telefonens inställning "Minska rörelse": då visas allt direkt utan animation.
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';

const native = Platform.OS !== 'web';

let reduced = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => (reduced = v)).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => (reduced = v));

export function useReducedMotion() {
  const [r, setR] = useState(reduced);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setR).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setR);
    return () => sub?.remove?.();
  }, []);
  return r;
}

/** Lätt vibration. 'tap' för vanliga knappar, 'select' för val, 'success' när något lyckats. */
export function haptic(kind: 'tap' | 'select' | 'success' | 'warning' = 'tap') {
  if (!native) return;
  const run =
    kind === 'select'
      ? Haptics.selectionAsync()
      : kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : kind === 'warning'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => {});
}

/** Tonar in och glider upp 8 px när vyn visas. Byt `key` för att spela om (t.ex. vid flikbyte). */
export function FadeIn({ children, style, delay = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [reduce, delay, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Pressable som sjunker till 97 % och fjädrar tillbaka. */
export function PressableScale({
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: React.ReactNode; scaleTo?: number }) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  // Layout (bredd, flex, marginaler, placering) hör till den yttre tryckytan, utseendet till den inre
  // som skalas. Annars krymper knappar med flex: 1 eller procentbredd.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle & Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(flat)) {
    if (/^(flex|flexGrow|flexShrink|flexBasis|width|minWidth|maxWidth|alignSelf|margin.*|position|top|left|right|bottom|zIndex)$/.test(k)) outer[k] = val;
    else inner[k] = val;
  }
  if (outer.width !== undefined || outer.flex !== undefined || outer.flexGrow !== undefined) inner.flexGrow = 1;
  const to = (value: number) =>
    reduce
      ? scale.setValue(1)
      : Animated.spring(scale, { toValue: value, useNativeDriver: native, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();
  return (
    <Pressable
      {...rest}
      style={outer as ViewStyle}
      disabled={disabled}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[inner as ViewStyle, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
