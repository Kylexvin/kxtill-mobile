// src/styles/theme.js
//
// Every theme is a superset of your existing `colors` keys, so current
// screens keep working. New semantic tokens: borderStrong, link, sheet,
// hero*, dangerSoft, onPrimaryMuted.

// ── colour helpers ────────────────────────────────────────────
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
const mix = (hex, target, amt) => {
  const [r, g, b] = toRgb(hex);
  const [tr, tg, tb] = toRgb(target);
  return toHex(r + (tr - r) * amt, g + (tg - g) * amt, b + (tb - b) * amt);
};
const alpha = (hex, a) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const luminance = (hex) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
// readable text colour on top of any accent
const onColor = (hex) => (luminance(hex) > 0.4 ? '#14110F' : '#FFFFFF');

// ── fun accent presets (none of them blue) ────────────────────
export const ACCENTS = {
  tomato: '#ff6a2b', // KxTill default
  mango: '#FFB000',
  mint: '#00B37E',
  grape: '#7B4DFF',
  //bubblegum: '#FF4D9D',
};

// ── base palettes (everything except the accent) ──────────────
const BASE = {
  dark: {
    mode: 'dark',
    background: '#0A0A0A',
    surface: '#141414',
    surfaceElevated: '#1E1E1E',
    border: '#2A2A2A',
    borderStrong: '#3A3A3A',
    textPrimary: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textMuted: '#6E6E6E',
    sheet: '#141414',
    success: '#2ECC71',
    warning: '#F5A623',
    danger: '#E5484D',
    dangerSoft: 'rgba(229, 72, 77, 0.12)',
    info: '#3B82F6',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  light: {
    mode: 'light',
    background: '#F4F2EF',
    surface: '#FFFFFF',
    surfaceElevated: '#FAF8F6',
    border: '#E4E0DB',
    borderStrong: '#CFC9C2',
    textPrimary: '#16120F',
    textSecondary: '#5E5750',
    textMuted: '#8F877E',
    sheet: '#FFFFFF',
    success: '#16A34A',
    warning: '#D98200',
    danger: '#D6293E',
    dangerSoft: 'rgba(214, 41, 62, 0.10)',
    info: '#2563EB',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
};

/** Build a full theme from a base mode + any accent colour. */
export function createTheme(mode = 'dark', accent = ACCENTS.tomato) {
  const base = BASE[mode] ?? BASE.dark;
  const onPrimary = onColor(accent);
  const primaryDark = mix(accent, '#000000', 0.22);
  // Text-sized accent must stay readable on the surface behind it.
  const link =
    mode === 'light' && luminance(accent) > 0.25
      ? mix(accent, '#000000', 0.4)
      : mode === 'dark' && luminance(accent) < 0.08
      ? mix(accent, '#FFFFFF', 0.35)
      : accent;

  return {
    ...base,
    accent,
    primary: accent,
    primaryDark,
    primaryLight: mix(accent, '#FFFFFF', 0.25),
    primarySoft: alpha(accent, 0.12),
    link,
    textOnPrimary: onPrimary,
    onPrimaryMuted: alpha(onPrimary, 0.85),
    onPrimaryBorder: alpha(onPrimary, 0.45),
    // hero = the big accent-coloured area of branded screens
    hero: accent,
    heroOrbA: mix(accent, '#FFFFFF', 0.25),
    heroOrbB: primaryDark,
    transparent: 'transparent',
  };
}

export const darkTheme = createTheme('dark');
export const lightTheme = createTheme('light');