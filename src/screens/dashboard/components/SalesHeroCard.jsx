// src/screens/dashboard/components/SalesHeroCard.jsx
//
// Hero stats card. Overlaps the header band (default 68px).
//
// Currency comes from the `currency` prop. On zero-sales days the card
// fetches the 7-day sales chart and shows a populated zero-state with
// real data instead of a bare "KES 0".

import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { useOrganizationContext } from '../../../context/OrganizationContext';
import { api } from '../../../services/api';
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
  box: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
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
  const { activeOrganization } = useOrganizationContext();
  const { width } = useWindowDimensions();
  const valueSize = clamp(Math.round(width * 0.1), 34, 46);
  const styles = useMemo(
    () => makeStyles(c, valueSize, overlap),
    [c, valueSize, overlap]
  );

  const prefix = typeof currency === 'string' ? currency.trim() : '';
  const hasDelta = delta != null && Number.isFinite(Number(delta));
  const up = hasDelta && Number(delta) >= 0;
  const tone = up ? c.success : c.danger;
  const isZero = Number(gross) === 0;

  // 7-day chart — only fetched on zero days, only once.
  const [weekChart, setWeekChart] = useState(null);
  useEffect(() => {
    if (!isZero) return undefined;
    const orgId = activeOrganization?.id;
    if (!orgId) return undefined;
    let cancelled = false;
    api
      .get(
        `/api/v1/organizations/${orgId}/kxtill/dashboard/sales-chart`,
        { params: { period: '7d' } }
      )
      .then((res) => {
        if (!cancelled) setWeekChart(res.data || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isZero, activeOrganization?.id]);

  const bars = useMemo(() => {
    if (isZero && weekChart?.data?.length) {
      const s = weekChart.data.map((d) => Math.max(0, Number(d.value) || 0));
      const max = Math.max(...s, 1);
      return s.map((n) => n / max);
    }
    if (!Array.isArray(series) || series.length < 2) return null;
    const s = series.slice(-24).map((n) => Math.max(0, Number(n) || 0));
    const max = Math.max(...s, 1);
    return s.map((n) => n / max);
  }, [isZero, weekChart, series]);

  const strip = Array.isArray(stats) ? stats.slice(0, 3) : [];
  const weekTotal = weekChart?.total != null ? Number(weekChart.total) : null;
  const weekAvg =
    weekChart?.data?.length ? weekTotal / weekChart.data.length : null;
  const weekTrend =
    weekChart?.trend != null ? Number(weekChart.trend) : null;

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.glow} />

      <View style={styles.top}>
        <View style={styles.labelRow}>
          <LiveDot color={c.primary} />
          <Text style={styles.label}>TODAY'S SALES</Text>
        </View>
        {!isZero && hasDelta ? (
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

      {isZero ? (
        /* ── Zero-state ───────────────────────────────── */
        <>
          <View style={styles.zeroTitleRow}>
            <Text style={styles.zeroTitle}>Quiet day so far</Text>
            <Text style={styles.zeroSub} numberOfLines={1}>
              {weekTotal != null && weekTotal > 0
                ? prefix
                  ? `${prefix} ${fmt(weekTotal)} over the last 7 days`
                  : `${fmt(weekTotal)} over the last 7 days`
                : 'Your first sale is waiting'}
            </Text>
          </View>

          {bars ? (
            <View style={styles.zeroBars}>
              {bars.map((v, i) => (
                <View key={i} style={styles.zeroBarCol}>
                  <View
                    style={[
                      styles.zeroBar,
                      {
                        height: Math.max(3, Math.round(v * 34)),
                        opacity:
                          i === bars.length - 1
                            ? 0.35
                            : v > 0
                              ? 1
                              : 0.25,
                      },
                    ]}
                  />
                  {weekChart?.data?.[i]?.label ? (
                    <Text style={styles.zeroBarLabel} numberOfLines={1}>
                      {weekChart.data[i].label.split(' ')[0]}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.strip}>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>
                {weekTotal != null
                  ? prefix
                    ? `${prefix} ${fmt(weekTotal)}`
                    : fmt(weekTotal)
                  : '—'}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                week total
              </Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue} numberOfLines={1}>
                {weekAvg != null
                  ? prefix
                    ? `${prefix} ${fmt(weekAvg)}`
                    : fmt(weekAvg)
                  : '—'}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                daily avg
              </Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text
                style={[
                  styles.statValue,
                  weekTrend != null &&
                    Number(weekTrend) !== 0 && {
                      color:
                        Number(weekTrend) >= 0 ? c.success : c.danger,
                    },
                ]}
                numberOfLines={1}
              >
                {weekTrend != null
                  ? `${Number(weekTrend) >= 0 ? '+' : ''}${weekTrend}%`
                  : '—'}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                vs last week
              </Text>
            </View>
          </View>
        </>
      ) : (
        /* ── Normal day ───────────────────────────────── */
        <>
          <View style={styles.valueRow}>
            {prefix ? <Text style={styles.currency}>{prefix}</Text> : null}
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(gross)}
            </Text>
          </View>
          <Text style={styles.sub}>
            {hasDelta
              ? 'vs usual pace for this time'
              : 'Not enough history yet'}
          </Text>

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

          {strip.length > 0 ? (
            <View style={styles.strip}>
              {strip.map((s, i) => {
                const isMoney = s?.isCurrency === true;
                const displayValue =
                  typeof s.value === 'number'
                    ? fmt(s.value)
                    : s.value ?? '';
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
        </>
      )}
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

    // Zero state
    zeroTitleRow: { marginTop: 12 },
    zeroTitle: {
      color: c.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    zeroSub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    zeroBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 50,
      marginTop: 16,
    },
    zeroBarCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    zeroBar: {
      width: '70%',
      backgroundColor: c.primary,
      borderRadius: 3,
    },
    zeroBarLabel: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: '600',
      marginTop: 4,
    },

    // Normal day bars
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