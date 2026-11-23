// The app's Text (M6d, 21/11/2026): the same as React Native's, except that every digit and the rupee sign are set in
// Manrope at the weight of the words around them, exactly as the website does (web/app/app-fonts.ts puts a Manrope face
// covering only 0-9 and ₹ in front of every font). Every screen imports Text from here, never from 'react-native'.
import React from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fonts } from '../theme/tokens';

const DIGITS = /([0-9₹]+)/;
const digit: TextStyle = { fontFamily: fonts.number };
const digitLight: TextStyle = { fontFamily: fonts.number, fontWeight: '300' };

function split(children: React.ReactNode, style: TextStyle): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'number') child = String(child);
    if (typeof child !== 'string' || !DIGITS.test(child)) return child;
    return child.split(DIGITS).map((part, i) =>
      i % 2 === 1 ? <RNText key={i} style={style}>{part}</RNText> : part,
    );
  });
}

export function Text({ children, style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  // Already the number font (KPI values, counts): nothing to change.
  if (flat?.fontFamily === fonts.number) return <RNText style={style} {...rest}>{children}</RNText>;
  return (
    <RNText style={style} {...rest}>
      {split(children, flat?.fontFamily === fonts.light ? digitLight : digit)}
    </RNText>
  );
}
