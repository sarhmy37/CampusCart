import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSizeKey = 'small' | 'default' | 'large' | 'xlarge';
export type FontStyleKey = 'system' | 'rounded' | 'serif' | 'mono';

const FONT_SCALE: Record<FontSizeKey, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  xlarge: 1.3,
};

// Font family per style, split by weight. Empty string means "use the
// system default" — leaving fontFamily undefined so RN falls back normally.
const FONT_FAMILY_MAP: Record<FontStyleKey, { regular?: string; bold?: string }> = {
  system: {},
  rounded: Platform.select({
    ios: { regular: 'Avenir-Book', bold: 'Avenir-Heavy' },
    android: { regular: 'sans-serif-medium', bold: 'sans-serif-medium' },
    default: {},
  }) as any,
  serif: Platform.select({
    ios: { regular: 'Georgia', bold: 'Georgia-Bold' },
    android: { regular: 'serif', bold: 'serif' },
    default: {},
  }) as any,
  mono: Platform.select({
    ios: { regular: 'Menlo', bold: 'Menlo-Bold' },
    android: { regular: 'monospace', bold: 'monospace' },
    default: {},
  }) as any,
};

const STORAGE_KEY = 'app_font_settings';

type FontSettings = {
  sizeKey: FontSizeKey;
  bold: boolean;
  styleKey: FontStyleKey;
};

const DEFAULTS: FontSettings = { sizeKey: 'default', bold: false, styleKey: 'system' };

type FontContextValue = FontSettings & {
  setSizeKey: (k: FontSizeKey) => void;
  setBold: (b: boolean) => void;
  setStyleKey: (k: FontStyleKey) => void;
  /** Scale a base pixel size by the current size preference. */
  scaleFont: (base: number) => number;
  /** Resolve the font family for the current style preference. */
  fontFamily: (weight?: 'regular' | 'bold') => string | undefined;
  /** Bump a base RN fontWeight up to bold if the Bold Text setting is on. */
  fontWeight: (baseWeight?: string) => string;
};

const FontContext = createContext<FontContextValue | null>(null);

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FontSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  const value = useMemo<FontContextValue>(() => {
    const scale = FONT_SCALE[settings.sizeKey];
    const family = FONT_FAMILY_MAP[settings.styleKey] || {};

    return {
      ...settings,
      setSizeKey: (sizeKey) => setSettings((s) => ({ ...s, sizeKey })),
      setBold: (bold) => setSettings((s) => ({ ...s, bold })),
      setStyleKey: (styleKey) => setSettings((s) => ({ ...s, styleKey })),
      scaleFont: (base: number) => Math.round(base * scale),
      fontFamily: (weight: 'regular' | 'bold' = 'regular') =>
        weight === 'bold' ? family.bold : family.regular,
      fontWeight: (baseWeight = '400') => (settings.bold ? '700' : baseWeight),
    };
  }, [settings]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useFontSettings() {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error('useFontSettings must be used within a <FontProvider>');
  return ctx;
}