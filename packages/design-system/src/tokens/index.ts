/**
 * Design token NAMES and TYPES only — never values.
 *
 * The CSS custom properties in `src/styles/tokens/*.css` are the
 * single source of truth for actual values. This file exists so
 * component code and consumers can reference token names in a
 * type-safe way (e.g. `style={{ color: `var(${TOKEN_COLOR_ACCENT})` }}`)
 * without duplicating values here — duplicating values would break
 * runtime theme switching (OS theme follow in the future Electron
 * shell changes `data-theme` at runtime, no rebuild involved).
 */

// ---------------------------------------------------------------------------
// Color — backgrounds & surfaces
// ---------------------------------------------------------------------------
export const TOKEN_COLOR_BG_CANVAS = '--ph-color-bg-canvas' as const;
export const TOKEN_COLOR_SURFACE_RAISED = '--ph-color-surface-raised' as const;
export const TOKEN_COLOR_SURFACE_OVERLAY = '--ph-color-surface-overlay' as const;
export const TOKEN_COLOR_SURFACE_SUNKEN = '--ph-color-surface-sunken' as const;
export const TOKEN_COLOR_SURFACE_HOVER = '--ph-color-surface-hover' as const;
export const TOKEN_COLOR_SURFACE_ACTIVE = '--ph-color-surface-active' as const;
export const TOKEN_COLOR_SURFACE_INVERSE = '--ph-color-surface-inverse' as const;
export const TOKEN_COLOR_OVERLAY_SCRIM = '--ph-color-overlay-scrim' as const;

// ---------------------------------------------------------------------------
// Color — text
// ---------------------------------------------------------------------------
export const TOKEN_COLOR_TEXT_DEFAULT = '--ph-color-text-default' as const;
export const TOKEN_COLOR_TEXT_MUTED = '--ph-color-text-muted' as const;
export const TOKEN_COLOR_TEXT_SUBTLE = '--ph-color-text-subtle' as const;
export const TOKEN_COLOR_TEXT_INVERSE = '--ph-color-text-inverse' as const;
export const TOKEN_COLOR_TEXT_ON_ACCENT = '--ph-color-text-on-accent' as const;
export const TOKEN_COLOR_TEXT_DISABLED = '--ph-color-text-disabled' as const;

// ---------------------------------------------------------------------------
// Color — accent
// ---------------------------------------------------------------------------
export const TOKEN_COLOR_ACCENT = '--ph-color-accent' as const;
export const TOKEN_COLOR_ACCENT_HOVER = '--ph-color-accent-hover' as const;
export const TOKEN_COLOR_ACCENT_ACTIVE = '--ph-color-accent-active' as const;
export const TOKEN_COLOR_ACCENT_SUBTLE = '--ph-color-accent-subtle' as const;
export const TOKEN_COLOR_ACCENT_SUBTLE_TEXT = '--ph-color-accent-subtle-text' as const;

// ---------------------------------------------------------------------------
// Color — borders
// ---------------------------------------------------------------------------
export const TOKEN_COLOR_BORDER_SUBTLE = '--ph-color-border-subtle' as const;
export const TOKEN_COLOR_BORDER_STRONG = '--ph-color-border-strong' as const;
export const TOKEN_COLOR_BORDER_FOCUS = '--ph-color-border-focus' as const;

// ---------------------------------------------------------------------------
// Color — status: danger / success / warning
// ---------------------------------------------------------------------------
export const TOKEN_COLOR_DANGER = '--ph-color-danger' as const;
export const TOKEN_COLOR_DANGER_HOVER = '--ph-color-danger-hover' as const;
export const TOKEN_COLOR_DANGER_ACTIVE = '--ph-color-danger-active' as const;
export const TOKEN_COLOR_DANGER_SUBTLE = '--ph-color-danger-subtle' as const;
export const TOKEN_COLOR_DANGER_SUBTLE_TEXT = '--ph-color-danger-subtle-text' as const;

export const TOKEN_COLOR_SUCCESS = '--ph-color-success' as const;
export const TOKEN_COLOR_SUCCESS_HOVER = '--ph-color-success-hover' as const;
export const TOKEN_COLOR_SUCCESS_ACTIVE = '--ph-color-success-active' as const;
export const TOKEN_COLOR_SUCCESS_SUBTLE = '--ph-color-success-subtle' as const;
export const TOKEN_COLOR_SUCCESS_SUBTLE_TEXT = '--ph-color-success-subtle-text' as const;

export const TOKEN_COLOR_WARNING = '--ph-color-warning' as const;
export const TOKEN_COLOR_WARNING_HOVER = '--ph-color-warning-hover' as const;
export const TOKEN_COLOR_WARNING_ACTIVE = '--ph-color-warning-active' as const;
export const TOKEN_COLOR_WARNING_SUBTLE = '--ph-color-warning-subtle' as const;
export const TOKEN_COLOR_WARNING_SUBTLE_TEXT = '--ph-color-warning-subtle-text' as const;

// ---------------------------------------------------------------------------
// Focus ring
// ---------------------------------------------------------------------------
export const TOKEN_FOCUS_RING = '--ph-focus-ring' as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------
export const TOKEN_SPACE_0 = '--ph-space-0' as const;
export const TOKEN_SPACE_1 = '--ph-space-1' as const;
export const TOKEN_SPACE_2 = '--ph-space-2' as const;
export const TOKEN_SPACE_3 = '--ph-space-3' as const;
export const TOKEN_SPACE_4 = '--ph-space-4' as const;
export const TOKEN_SPACE_5 = '--ph-space-5' as const;
export const TOKEN_SPACE_6 = '--ph-space-6' as const;
export const TOKEN_SPACE_8 = '--ph-space-8' as const;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------
export const TOKEN_RADIUS_SM = '--ph-radius-sm' as const;
export const TOKEN_RADIUS_MD = '--ph-radius-md' as const;
export const TOKEN_RADIUS_LG = '--ph-radius-lg' as const;
export const TOKEN_RADIUS_FULL = '--ph-radius-full' as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------
export const TOKEN_SHADOW_SM = '--ph-shadow-sm' as const;
export const TOKEN_SHADOW_MD = '--ph-shadow-md' as const;
export const TOKEN_SHADOW_LG = '--ph-shadow-lg' as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
export const TOKEN_FONT_FAMILY_BASE = '--ph-font-family-base' as const;
export const TOKEN_FONT_FAMILY_MONO = '--ph-font-family-mono' as const;

export const TOKEN_FONT_SIZE_XS = '--ph-font-size-xs' as const;
export const TOKEN_FONT_SIZE_SM = '--ph-font-size-sm' as const;
export const TOKEN_FONT_SIZE_MD = '--ph-font-size-md' as const;
export const TOKEN_FONT_SIZE_LG = '--ph-font-size-lg' as const;
export const TOKEN_FONT_SIZE_XL = '--ph-font-size-xl' as const;
export const TOKEN_FONT_SIZE_2XL = '--ph-font-size-2xl' as const;
export const TOKEN_FONT_SIZE_3XL = '--ph-font-size-3xl' as const;

export const TOKEN_FONT_WEIGHT_REGULAR = '--ph-font-weight-regular' as const;
export const TOKEN_FONT_WEIGHT_MEDIUM = '--ph-font-weight-medium' as const;
export const TOKEN_FONT_WEIGHT_SEMIBOLD = '--ph-font-weight-semibold' as const;
export const TOKEN_FONT_WEIGHT_BOLD = '--ph-font-weight-bold' as const;

export const TOKEN_LINE_HEIGHT_TIGHT = '--ph-line-height-tight' as const;
export const TOKEN_LINE_HEIGHT_NORMAL = '--ph-line-height-normal' as const;
export const TOKEN_LINE_HEIGHT_RELAXED = '--ph-line-height-relaxed' as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------
export const TOKEN_DURATION_FAST = '--ph-duration-fast' as const;
export const TOKEN_DURATION_BASE = '--ph-duration-base' as const;
export const TOKEN_EASING_STANDARD = '--ph-easing-standard' as const;

// ---------------------------------------------------------------------------
// Grouped unions
// ---------------------------------------------------------------------------
export type ColorToken =
  | typeof TOKEN_COLOR_BG_CANVAS
  | typeof TOKEN_COLOR_SURFACE_RAISED
  | typeof TOKEN_COLOR_SURFACE_OVERLAY
  | typeof TOKEN_COLOR_SURFACE_SUNKEN
  | typeof TOKEN_COLOR_SURFACE_HOVER
  | typeof TOKEN_COLOR_SURFACE_ACTIVE
  | typeof TOKEN_COLOR_SURFACE_INVERSE
  | typeof TOKEN_COLOR_OVERLAY_SCRIM
  | typeof TOKEN_COLOR_TEXT_DEFAULT
  | typeof TOKEN_COLOR_TEXT_MUTED
  | typeof TOKEN_COLOR_TEXT_SUBTLE
  | typeof TOKEN_COLOR_TEXT_INVERSE
  | typeof TOKEN_COLOR_TEXT_ON_ACCENT
  | typeof TOKEN_COLOR_TEXT_DISABLED
  | typeof TOKEN_COLOR_ACCENT
  | typeof TOKEN_COLOR_ACCENT_HOVER
  | typeof TOKEN_COLOR_ACCENT_ACTIVE
  | typeof TOKEN_COLOR_ACCENT_SUBTLE
  | typeof TOKEN_COLOR_ACCENT_SUBTLE_TEXT
  | typeof TOKEN_COLOR_BORDER_SUBTLE
  | typeof TOKEN_COLOR_BORDER_STRONG
  | typeof TOKEN_COLOR_BORDER_FOCUS
  | typeof TOKEN_COLOR_DANGER
  | typeof TOKEN_COLOR_DANGER_HOVER
  | typeof TOKEN_COLOR_DANGER_ACTIVE
  | typeof TOKEN_COLOR_DANGER_SUBTLE
  | typeof TOKEN_COLOR_DANGER_SUBTLE_TEXT
  | typeof TOKEN_COLOR_SUCCESS
  | typeof TOKEN_COLOR_SUCCESS_HOVER
  | typeof TOKEN_COLOR_SUCCESS_ACTIVE
  | typeof TOKEN_COLOR_SUCCESS_SUBTLE
  | typeof TOKEN_COLOR_SUCCESS_SUBTLE_TEXT
  | typeof TOKEN_COLOR_WARNING
  | typeof TOKEN_COLOR_WARNING_HOVER
  | typeof TOKEN_COLOR_WARNING_ACTIVE
  | typeof TOKEN_COLOR_WARNING_SUBTLE
  | typeof TOKEN_COLOR_WARNING_SUBTLE_TEXT;

export type SpaceToken =
  | typeof TOKEN_SPACE_0
  | typeof TOKEN_SPACE_1
  | typeof TOKEN_SPACE_2
  | typeof TOKEN_SPACE_3
  | typeof TOKEN_SPACE_4
  | typeof TOKEN_SPACE_5
  | typeof TOKEN_SPACE_6
  | typeof TOKEN_SPACE_8;

export type RadiusToken =
  | typeof TOKEN_RADIUS_SM
  | typeof TOKEN_RADIUS_MD
  | typeof TOKEN_RADIUS_LG
  | typeof TOKEN_RADIUS_FULL;

export type ShadowToken = typeof TOKEN_SHADOW_SM | typeof TOKEN_SHADOW_MD | typeof TOKEN_SHADOW_LG;

export type FontSizeToken =
  | typeof TOKEN_FONT_SIZE_XS
  | typeof TOKEN_FONT_SIZE_SM
  | typeof TOKEN_FONT_SIZE_MD
  | typeof TOKEN_FONT_SIZE_LG
  | typeof TOKEN_FONT_SIZE_XL
  | typeof TOKEN_FONT_SIZE_2XL
  | typeof TOKEN_FONT_SIZE_3XL;

export type FontWeightToken =
  | typeof TOKEN_FONT_WEIGHT_REGULAR
  | typeof TOKEN_FONT_WEIGHT_MEDIUM
  | typeof TOKEN_FONT_WEIGHT_SEMIBOLD
  | typeof TOKEN_FONT_WEIGHT_BOLD;

export type DesignToken = ColorToken | SpaceToken | RadiusToken | ShadowToken | FontSizeToken | FontWeightToken;
