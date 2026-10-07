/**
 * Colors used across the app, in light and dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Text
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    textFaint: '#94a3b8',
    textOnGold: '#ffffff',

    // Backgrounds
    background: '#f1f5f9',
    backgroundAlt: '#f8fafc',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    card: '#ffffff',
    cardAlt: '#f8fafc',
    inputBg: '#ffffff',
    chipBg: '#f1f5f9',

    // Borders
    border: '#e2e8f0',
    borderMuted: '#f1f5f9',

    // Brand (gold)
    brand: '#B87515',        // brand-600 — buttons
    brandDark: '#935814',    // brand-700 — text
    brandSoft: '#FDF8EC',    // brand-50
    brandText: '#935814',    // text gold
    badge: '#ef4444',   // text gold

    // Status
    success: '#059669',
    successSoft: '#ecfdf5',
    error: '#dc2626',
    errorSoft: '#fef2f2',
    warning: '#b45309',
    warningSoft: '#fffbeb',
    info: '#1d4ed8',
    infoSoft: '#eff6ff',

    // Overlays
    overlay: 'rgba(15,23,42,0.5)',
    overlayLight: 'rgba(15,23,42,0.4)',

    // Header
    headerOverlay: 'rgba(15,23,42,0.65)',
    headerText: '#ffffff',
    headerMuted: 'rgba(255,255,255,0.7)',
    headerPill: 'rgba(255,255,255,0.1)',
    headerPillBorder: 'rgba(255,255,255,0.3)',
  },
  dark: {
    // Text (matching web dark-mode gold scale)
    // Text
    text: '#f5f0e6',
    textSecondary: '#d9d2c4',
    textMuted: '#a89f8d',
    textFaint: '#7a7264',
    textOnGold: '#0d0c0a',

    // Backgrounds (matching web ink-* scale)
    background: '#0d0c0a',       // ink-900 — page bg
    backgroundAlt: '#0d0c0a',     // same
    backgroundElement: '#211e19', // ink-700
    backgroundSelected: '#2c2822', // ink-600
    card: '#161411',             // ink-800 — cards
    cardAlt: '#211e19',          // ink-700 — sub-sections
    inputBg: '#211e19',          // ink-700
    chipBg: '#211e19',           // ink-700

    // Borders (matching ink-600 / ink-500)
    border: '#2c2822',           // ink-600
    borderMuted: '#211e19',      // ink-700

    // Brand (gold)
    brand: '#E6AB2B',        // gold-400 — brighter for dark bg
    brandDark: '#D4941C',    // gold-500
    brandSoft: 'rgba(230,171,43,0.12)',
    brandText: '#E6AB2B',
    badge: '#f87171',
    // Status
    success: '#34d399',
    successSoft: 'rgba(52,211,153,0.12)',
    error: '#f87171',
    errorSoft: 'rgba(248,113,113,0.12)',
    warning: '#fbbf24',
    warningSoft: 'rgba(251,191,36,0.12)',
    info: '#60a5fa',
    infoSoft: 'rgba(96,165,250,0.12)',

    // Overlays
    overlay: 'rgba(0,0,0,0.7)',
    overlayLight: 'rgba(0,0,0,0.55)',

    // Header
    headerOverlay: 'rgba(13,12,10,0.75)',
    headerText: '#ffffff',
    headerMuted: 'rgba(255,255,255,0.7)',
    headerPill: 'rgba(255,255,255,0.1)',
    headerPillBorder: 'rgba(255,255,255,0.3)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeColors = typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const SCREEN_PADDING_X = Spacing.three;