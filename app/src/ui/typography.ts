import type { TextStyle } from 'react-native';

export type TextVariant =
  | 'eyebrow'
  | 'display'
  | 'title'
  | 'section'
  | 'body'
  | 'label'
  | 'caption'
  | 'helper'
  | 'number'
  | 'button';

export const textVariants: Record<TextVariant, TextStyle> = {
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.96, textTransform: 'uppercase' },
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.85, lineHeight: 37 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -0.9, lineHeight: 39 },
  section: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '500', lineHeight: 24 },
  label: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  helper: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  number: { fontSize: 46, fontWeight: '700', letterSpacing: -1.4, lineHeight: 48 },
  button: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
};

/**
 * Largest Dynamic Type scale each role may reach before the layout caps it.
 * Display roles keep tighter caps so large numbers cannot push a row apart.
 */
export const textMaxScale: Record<TextVariant, number> = {
  eyebrow: 1.4,
  display: 1.2,
  title: 1.2,
  section: 1.35,
  body: 1.6,
  label: 1.5,
  caption: 1.5,
  helper: 1.5,
  number: 1.2,
  button: 1.4,
};

/**
 * React Native scales `fontSize` with Dynamic Type but leaves an explicit
 * `lineHeight` fixed, which clips the text. Scale it by the same factor.
 */
export function scaledLineHeight(
  lineHeight: number | undefined,
  fontScale: number,
  maxScale: number,
): number | undefined {
  if (lineHeight === undefined) return undefined;
  return Math.round(lineHeight * Math.min(fontScale, maxScale) * 10) / 10;
}
