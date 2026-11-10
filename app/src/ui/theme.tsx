import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'ember' | 'graphite';

export type Theme = {
  mode: ThemeMode;
  bg: string;
  card: string;
  line: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
  highlight: string;
  link: string;
  tint: string;
  panelTint: string;
  ok: string;
  okBg: string;
  okText: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  track: string;
  toggleOn: string;
  toggleKnob: string;
  navBg: string;
  navLine: string;
  navInactive: string;
  navActive: string;
  scrim: string;
  radius: { button: number; card: number; field: number; icon: number; sheet: number };
  font: {
    regular: string;
    semibold: string;
    bold: string;
    extrabold: string;
    number: string;
    numberMedium: string;
  };
};

const font = {
  regular: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  number: 'SpaceGrotesk_700Bold',
  numberMedium: 'SpaceGrotesk_500Medium',
};

const ember: Theme = {
  mode: 'ember',
  bg: '#FAF6F1',
  card: '#FFFFFF',
  line: '#EFE7DD',
  border: '#8F8279',
  ink: '#1B1512',
  muted: '#6B5E57',
  accent: '#C9340C',
  onAccent: '#FFFFFF',
  highlight: '#C9340C',
  link: '#B22E0A',
  tint: '#FDE9E2',
  panelTint: '#FDE9E2',
  ok: '#1B7A4B',
  okBg: '#E1F3E8',
  okText: '#14603B',
  warn: '#A15C07',
  warnBg: '#FBEBD0',
  danger: '#8E1B1B',
  dangerBg: '#FBE4E1',
  track: '#EFE7DD',
  toggleOn: '#1B7A4B',
  toggleKnob: '#FFFFFF',
  navBg: '#FFFFFF',
  navLine: '#EFE7DD',
  navInactive: '#6B5E57',
  navActive: '#C9340C',
  scrim: 'rgba(20,16,12,0.45)',
  radius: { button: 28, card: 14, field: 12, icon: 10, sheet: 16 },
  font,
};

const graphite: Theme = {
  mode: 'graphite',
  bg: '#121212',
  card: '#1E1E1E',
  line: '#2E2E2E',
  border: '#6B6B6B',
  ink: '#F5F5F5',
  muted: '#A3A3A3',
  accent: '#C8320F',
  onAccent: '#FFFFFF',
  highlight: '#F7A98C',
  link: '#F7A98C',
  tint: '#3A1A12',
  panelTint: '#2E2420',
  ok: '#7CE3A1',
  okBg: '#16301F',
  okText: '#7CE3A1',
  warn: '#F5B454',
  warnBg: '#3A2B12',
  danger: '#FF8E85',
  dangerBg: '#3A1B18',
  track: '#2E2E2E',
  toggleOn: '#7CE3A1',
  toggleKnob: '#16301F',
  navBg: '#181818',
  navLine: '#2E2E2E',
  navInactive: '#9A9A9A',
  navActive: '#F7A98C',
  scrim: 'rgba(0,0,0,0.6)',
  radius: { button: 22, card: 18, field: 14, icon: 12, sheet: 24 },
  font,
};

const ThemeContext = createContext<Theme>(ember);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const theme = scheme === 'dark' ? graphite : ember;
  if (!loaded && !error) return null;
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.mode === 'graphite' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Percent remaining, clamped to 0-100. Returns null when the interval is unknown. */
export function progressPercent(remaining: number | null, total: number | null): number | null {
  if (remaining === null || total === null || total <= 0) return null;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}
