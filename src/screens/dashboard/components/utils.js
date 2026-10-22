// src/screens/dashboard/components/utils.js
//
// Shared formatters and safety helpers. Kept dependency-free so it can be
// imported by every leaf component without pulling anything extra.

export const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// Backend can send any string as an icon name. Ionicons throws (or renders
// a blank) on unknown names in some RN versions. We keep a small whitelist
// of icons this screen actually uses and fall back to a neutral dot.
const SAFE_ICONS = new Set([
  'alert-circle-outline',
  'alert-outline',
  'cash-outline',
  'receipt-outline',
  'trending-up-outline',
  'trending-down-outline',
  'cube-outline',
  'person-outline',
  'people-outline',
  'card-outline',
  'phone-portrait-outline',
  'storefront-outline',
  'time-outline',
  'warning-outline',
  'information-circle-outline',
  'ellipse-outline',
  'add-outline',
  'arrow-up',
  'arrow-down',
  'arrow-up-outline',
  'arrow-down-outline',
  'chevron-down',
  'checkmark',
  'cart-outline',
  'barcode-outline',
  'calculator-outline',
  'print-outline',
  'bar-chart-outline',
  'stats-chart-outline',
  'wallet-outline',
  'swap-horizontal-outline',
]);

export function safeIcon(name, fallback = 'ellipse-outline') {
  return SAFE_ICONS.has(name) ? name : fallback;
}

export function payColor(id, c) {
  if (id === 'mpesa') return c.success;
  if (id === 'cash') return c.primary;
  if (id === 'card') return c.warning || c.textSecondary;
  return c.textMuted;
}

export function severityTone(t, c) {
  if (t === 'danger')
    return { bg: c.dangerSoft, fg: c.danger };
  if (t === 'warning') return { bg: 'rgba(245,166,35,0.15)', fg: c.warning };
  return { bg: c.primarySoft, fg: c.primary };
}