// src/screens/dashboard/components/SalesHeroCard.jsx
//
// Hero stats card. Overlaps the header band (default 68px, pass
// `overlap={0}` to disable).
//
// Currency:
//   - The `currency` prop is authoritative. It comes from the backend's
//     `sales.currency` field (which itself resolves from the org's
//     settings row). If it's null or undefined, no prefix is rendered —
//     the number shows bare. No country fallback.
//
// Props:
//   currency, gross, delta
//   series   number[]
//   stats    [{ label, value, isCurrency? }]
//   overlap  number

import { memo, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { fmt } from './utils';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function LiveDot({ color }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={dot.box}>
      <Animated.View
        style={[
          dot.ring,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 0],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1.7],
                }),
              },
            ],
          },
        ]}
      />
      <View style={[dot.core, { backgroundColor: color }]} />
    </View>
  );
}
const dot = StyleSheet.create({
  box: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  core: { width: 6, height: 6, borderRadius: 3 },
});

function SalesHeroCardBase({
  currency,
  gross,
  delta,
  series,
  stats,
  overlap = 68,
}) {
  const { theme: c } = useTheme();
  const { width } = useWindowDimensions();
  const valueSize = clamp(Math.round(width * 0.1), 34, 46);
  const styles = useMemo(
    () => makeStyles(c, valueSize, overlap),
    [c, valueSize, overlap]
  );

  // Resolve currency: pass-through only. No org fallback here — the
  // backend already resolved it from settings. Trim to catch `''` from
  // accidental upstream defaults; treat empty as "no prefix".
  const prefix = typeof currency === 'string' ? currency.trim() : '';

  const hasDelta = delta != null && Number.isFinite(Number(delta));
  const up = hasDelta && Number(delta) >= 0;
  const tone = up ? c.success : c.danger;

  const bars = useMemo(() => {
    if (!Array.isArray(series) || series.length < 2) return null;
    const s = series.slice(-24).map((n) => Math.max(0, Number(n) || 0));
    const max = Math.max(...s, 1);
    return s.map((n) => n / max);
  }, [series]);

  const strip = Array.isArray(stats) ? stats.slice(0, 3) : [];

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.glow} />

      {/* Label + delta */}
      <View style={styles.top}>
        <View style={styles.labelRow}>
          <LiveDot color={c.primary} />
          <Text style={styles.label}>TODAY'S SALES</Text>
        </View>
        {hasDelta ? (
          <View style={[styles.delta, { backgroundColor: c.surfaceElevated }]}>
            <Ionicons
              name={up ? 'trending-up' : 'trending-down'}
              size={13}
              color={tone}
            />
            <Text style={[styles.deltaText, { color: tone }]}>
              {up ? '+' : '−'}
              {Math.abs(Number(delta))}%
            </Text>
          </View>
        ) : null}
      </View>

      {/* Total */}
      <View style={styles.valueRow}>
        {prefix ? <Text style={styles.currency}>{prefix}</Text> : null}
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(gross)}
        </Text>
      </View>
      <Text style={styles.sub}>
        {hasDelta
          ? 'vs usual pace for this time'
          : Number(gross) === 0
            ? 'No sales yet today'
            : 'Not enough history yet'}
      </Text>

      {/* Trend */}
      {bars ? (
        <View style={styles.bars}>
          {bars.map((v, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: Math.max(3, Math.round(v * 30)) },
                i === bars.length - 1 && styles.barLast,
              ]}
            />
          ))}
        </View>
      ) : null}

      {/* Stat strip — money stats prefix with currency; counts stay bare */}
      {strip.length > 0 ? (
        <View style={styles.strip}>
          {strip.map((s, i) => {
            const isMoney = s?.isCurrency === true;
            const displayValue =
              typeof s.value === 'number' ? fmt(s.value) : s.value ?? '';
            return (
              <View
                key={s.label}
                style={[styles.stat, i > 0 && styles.statDivider]}
              >
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isMoney && prefix
                    ? `${prefix} ${displayValue}`
                    : displayValue}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c, valueSize, overlap) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginTop: -overlap,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    glow: {
      position: 'absolute',
      top: -90,
      right: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: c.primary,
      opacity: 0.1,
    },

    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    label: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
    },
    delta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
    },
    deltaText: { fontSize: 12, fontWeight: '800' },

    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 12,
    },
    currency: { color: c.link, fontSize: 16, fontWeight: '800' },
    value: {
      flexShrink: 1,
      color: c.textPrimary,
      fontSize: valueSize,
      lineHeight: valueSize + 6,
      fontWeight: '900',
      letterSpacing: -1.4,
      fontVariant: ['tabular-nums'],
    },
    sub: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },

    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
      height: 30,
      marginTop: 16,
    },
    bar: {
      flex: 1,
      borderRadius: 2,
      backgroundColor: c.primary,
      opacity: 0.25,
    },
    barLast: { opacity: 1 },

    strip: {
      flexDirection: 'row',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    stat: { flex: 1, paddingRight: 8 },
    statDivider: {
      paddingLeft: 14,
      borderLeftWidth: 1,
      borderLeftColor: c.border,
    },
    statValue: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
  });

export const SalesHeroCard = memo(SalesHeroCardBase);
export default SalesHeroCard;