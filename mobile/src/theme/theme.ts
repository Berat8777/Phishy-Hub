/**
 * Plain RN style tokens mirroring packages/design-system's palette (blue
 * primary, orange CTA accent, Plus Jakarta Sans) — hand-copied values, NOT
 * an import of the Vue design system (can't cross Vue -> React Native, see
 * repo CLAUDE.md hard rule and this module's task brief). Kept deliberately
 * small: light-mode only, no dark-mode theming pass in this scope.
 *
 * Source of truth for the numbers: packages/design-system/src/styles/tokens/{primitives,semantic,typography}.css
 */

export const palette = {
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',

  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange700: '#c2410c',

  red50: '#fef2f2',
  red500: '#ef4444',
  red600: '#dc2626',

  green500: '#22c55e',
  green600: '#16a34a',
} as const;

export const colors = {
  bgCanvas: palette.slate50,
  surfaceRaised: '#ffffff',
  surfaceSunken: palette.slate100,
  surfaceHover: palette.slate100,

  textDefault: palette.slate800,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  textInverse: '#ffffff',
  textOnAccent: '#ffffff',

  accent: palette.blue600,
  accentHover: palette.blue700,
  accentSubtle: palette.blue50,
  accentSubtleText: palette.blue700,

  cta: palette.orange500,
  ctaHover: palette.orange600,
  ctaSubtle: palette.orange50,
  ctaSubtleText: palette.orange700,

  borderSubtle: palette.slate200,
  borderStrong: palette.slate300,

  danger: palette.red500,
  dangerHover: palette.red600,
  dangerSubtle: palette.red50,

  success: palette.green500,
  successHover: palette.green600,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  8: 48,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

/**
 * `@expo-google-fonts/plus-jakarta-sans` family keys registered by
 * `useFonts()` in app/_layout.tsx. Falls back to the RN default system font
 * automatically while loading / if font loading ever fails, since RN simply
 * ignores an unregistered `fontFamily` name rather than erroring.
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;
