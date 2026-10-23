// src/screens/branches/BranchSalesScreen.jsx
//
// v4 — currency via settings context.
//   - Reads formatCurrency from useSettings().
//   - Drops `currency` prop from FloatingHeader.
//   - All other layout, skeleton, cache, scroll-to-section, and race
//     handling unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import branchesService from '../../services/branches.service';
import {
  readBranchSalesCache,
  writeBranchSalesCache,
} from '../../cache/cache';

/* ── utils ─────────────────────────────────────────────────────── */

const relTime = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const PERIOD = 'today';

/* ── Skeleton primitive ───────────────────────────────────────── */

function Sk({ width, height, r = 8, style }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        { backgroundColor: '#D7DCE3', opacity: pulse },
        { width, height, borderRadius: r },
        style,
      ]}
    />
  );
}

/* ── Skeleton layouts ─────────────────────────────────────────── */

function HeaderSkeleton({ styles, insets }) {
  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Sk width={36} height={36} r={18} />
          <Sk width={36} height={36} r={12} />
        </View>
        <Sk width={90} height={26} r={13} />
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sk width="60%" height={20} r={8} />
          <Sk width="45%" height={12} r={6} style={{ marginTop: 8 }} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Sk width={60} height={11} r={5} />
          <Sk width={120} height={26} r={8} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
      </View>

      <Sk width="100%" height={1} r={0} style={{ marginTop: 16 }} />

      <View style={styles.actionRow}>
        <Sk width="48%" height={42} r={12} />
        <Sk width="48%" height={42} r={12} />
      </View>
    </View>
  );
}

function BranchSalesSkeleton({ styles, insets }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <HeaderSkeleton styles={styles} insets={insets} />

        <View style={styles.body}>
          <View style={styles.section}>
            <Sk width={100} height={11} r={5} />
            <View style={styles.skCard}>
              <Sk width="100%" height={12} r={6} />
              <View style={styles.skLegendRow}>
                <Sk width={60} height={11} r={5} />
                <Sk width={60} height={11} r={5} />
                <Sk width={60} height={11} r={5} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Sk width={110} height={11} r={5} />
            <View style={styles.skCard}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.skRow, i > 0 && styles.skRowDivider]}
                >
                  <Sk width={24} height={24} r={12} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Sk width="60%" height={12} r={6} />
                    <Sk width="35%" height={10} r={5} />
                  </View>
                  <Sk width={64} height={12} r={6} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Sk width={140} height={11} r={5} />
            <View style={styles.skCard}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.skRow, i > 0 && styles.skRowDivider]}
                >
                  <Sk width={34} height={34} r={10} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Sk width="70%" height={12} r={6} />
                    <Sk width="40%" height={10} r={5} />
                  </View>
                  <Sk width={64} height={12} r={6} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Floating header ─────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  branchLabel,
  summary,
  delta,
  onBack,
  onOpenProducts,
  onOpenRecent,
}) {
  const { formatCurrency } = useSettings();
  const monogram = (branchLabel || 'B').trim().charAt(0).toUpperCase();
  const revenue = Number(summary?.revenue || 0);
  const tx = Number(summary?.transactions || 0);
  const avg = tx > 0 ? revenue / tx : 0;
  const items = Number(summary?.items || 0);
  const hasDelta = delta != null && Number.isFinite(Number(delta));
  const up = hasDelta && Number(delta) >= 0;

  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View pointerEvents="none" style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={onBack}
            hitSlop={10}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={c.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.monogramSmall}>
            <Text style={styles.monogramSmallText}>{monogram}</Text>
          </View>
        </View>

        <View style={[styles.statusChip, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="calendar-outline" size={11} color={c.primary} />
          <Text style={[styles.statusText, { color: c.primary }]}>Today</Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {branchLabel}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Sales
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.revKicker}>TOTAL</Text>
          <Text
            style={styles.revValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(revenue)}
          </Text>
        </View>
      </View>

      {hasDelta ? (
        <View style={styles.deltaRow}>
          <View
            style={[
              styles.deltaPill,
              { backgroundColor: up ? c.primarySoft : c.dangerSoft },
            ]}
          >
            <Ionicons
              name={up ? 'arrow-up' : 'arrow-down'}
              size={11}
              color={up ? c.success : c.danger}
            />
            <Text
              style={[
                styles.deltaText,
                { color: up ? c.success : c.danger },
              ]}
            >
              {Math.abs(Number(delta))}% vs usual
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.chipRow}>
        <Pressable
          onPress={onOpenRecent}
          style={styles.statChip}
          accessibilityRole="button"
        >
          <Ionicons name="receipt-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {tx}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            sales
          </Text>
        </Pressable>
        <View style={styles.statChip}>
          <Ionicons name="pricetag-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {formatCurrency(avg)}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            avg
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="cube-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {items}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            items
          </Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={onOpenProducts}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons
            name="cube-outline"
            size={14}
            color={c.textOnPrimary}
          />
          <Text style={styles.actionPrimaryText}>Top products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={onOpenRecent}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="receipt-outline" size={14} color={c.link} />
          <Text style={styles.actionSecondaryText}>Recent</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────── */

export default function BranchSalesScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { formatCurrency } = useSettings();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const dataRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(
    async (isRefresh = false) => {
      const orgId = activeOrganization?.id;
      if (!orgId || !branchId) {
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else if (dataRef.current == null) setLoading(true);
      setError(null);

      if (dataRef.current == null) {
        const cached = await readBranchSalesCache(orgId, branchId, PERIOD);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const res = await branchesService.getBranchSales(
          orgId,
          branchId,
          PERIOD
        );
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(res);
        setStaleError(null);
        writeBranchSalesCache(orgId, branchId, PERIOD, res);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load sales';
        if (dataRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOrganization?.id, branchId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const summary = data?.summary;
  const payments = data?.payments;
  const products = data?.topProducts || [];
  const recent = data?.recent || [];
  const branchLabel = data?.branch?.name || branchName || 'Branch';

  const payColor = (id) =>
    id === 'mpesa' ? c.success : id === 'cash' ? c.primary : c.textMuted;

  const scrollRef = useRef(null);
  const productsY = useRef(0);
  const recentY = useRef(0);

  const scrollTo = (yRef) => {
    if (scrollRef.current && yRef.current != null) {
      scrollRef.current.scrollTo({ y: yRef.current, animated: true });
    }
  };

  if (loading && !data && !error) {
    return <BranchSalesSkeleton styles={styles} insets={insets} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={c.primary}
          />
        }
      >
        <FloatingHeader
          c={c}
          styles={styles}
          insets={insets}
          branchLabel={branchLabel}
          summary={summary}
          delta={summary?.deltaPct}
          onBack={() => navigation.goBack()}
          onOpenProducts={() => scrollTo(productsY)}
          onOpenRecent={() => scrollTo(recentY)}
        />

        {staleError ? (
          <View style={styles.staleChip}>
            <Ionicons
              name="cloud-offline-outline"
              size={14}
              color={c.textSecondary}
            />
            <Text style={styles.staleText} numberOfLines={2}>
              Showing saved data · {staleError}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errText}>{error}</Text> : null}

        <View style={styles.body}>
          {payments?.methods?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PAYMENT MIX</Text>
              <View style={styles.card}>
                <View style={styles.mixBar}>
                  {payments.methods.map((p) => (
                    <View
                      key={p.id}
                      style={{ flex: p.pct, backgroundColor: payColor(p.id) }}
                    />
                  ))}
                </View>
                <View style={styles.mixLegend}>
                  {payments.methods.map((p) => (
                    <View key={p.id} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: payColor(p.id) },
                        ]}
                      />
                      <Text style={styles.legendLabel}>{p.label}</Text>
                      <Text style={styles.legendValue}>{p.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {products.length > 0 ? (
            <View
              style={styles.section}
              onLayout={(e) => {
                productsY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>TOP PRODUCTS</Text>
              <View style={styles.card}>
                {products.map((p, i) => (
                  <View
                    key={p.id || p.name}
                    style={[styles.productRow, i > 0 && styles.rowDivider]}
                  >
                    <Text style={styles.rank}>{i + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.productMeta}>{p.units} sold</Text>
                    </View>
                    <Text style={styles.productRevenue}>
                      {formatCurrency(p.revenue)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {recent.length > 0 ? (
            <View
              style={styles.section}
              onLayout={(e) => {
                recentY.current = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>
              <View style={styles.card}>
                {recent.map((s, i) => (
                  <View
                    key={s.id || i}
                    style={[styles.txRow, i > 0 && styles.rowDivider]}
                  >
                    <View style={styles.txIcon}>
                      <Ionicons
                        name="receipt-outline"
                        size={16}
                        color={c.primary}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {s.itemsSummary || `${s.items ?? 0} items`}
                      </Text>
                      <Text style={styles.txMeta} numberOfLines={1}>
                        {s.cashier} · {relTime(s.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.txAmount}>
                      {formatCurrency(s.total)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!summary && !recent.length && !products.length ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="receipt-outline"
                size={32}
                color={c.textMuted}
              />
              <Text style={styles.emptyText}>
                No sales recorded yet today.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxl },
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

    headerCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    headerGlow: {
      position: 'absolute',
      top: -100,
      right: -80,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: c.primary,
      opacity: 0.08,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramSmall: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramSmallText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

    identityRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 16,
    },
    headerName: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    headerSub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    revKicker: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
    },
    revValue: {
      color: c.textPrimary,
      fontSize: 30,
      lineHeight: 34,
      fontWeight: '900',
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      marginTop: 3,
    },

    deltaRow: { flexDirection: 'row', marginTop: 10 },
    deltaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
    },
    deltaText: { fontSize: 11, fontWeight: '800' },

    chipRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: c.surfaceElevated,
    },
    statChipValue: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    statChipLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },

    headerRule: {
      height: 1,
      backgroundColor: c.border,
      marginTop: 16,
      marginBottom: 14,
    },

    actionRow: { flexDirection: 'row', gap: 10 },
    actionPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    actionPrimaryText: {
      color: c.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    actionSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    actionSecondaryText: {
      color: c.link,
      fontSize: 13,
      fontWeight: '800',
    },

    staleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
    },
    staleText: {
      ...typography.caption,
      color: c.textSecondary,
      flex: 1,
      fontWeight: '600',
    },
    errText: {
      ...typography.caption,
      color: c.danger,
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
    },

    section: { marginTop: spacing.lg },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },

    mixBar: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      gap: 2,
    },
    mixLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { ...typography.caption, color: c.textSecondary },
    legendValue: {
      ...typography.caption,
      color: c.textPrimary,
      fontWeight: '800',
    },

    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    rank: {
      width: 24,
      height: 24,
      borderRadius: 12,
      textAlign: 'center',
      textAlignVertical: 'center',
      lineHeight: 24,
      fontSize: 12,
      fontWeight: '800',
      color: c.textSecondary,
      backgroundColor: c.surfaceElevated,
    },
    productName: { ...typography.bodyStrong, color: c.textPrimary },
    productMeta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    productRevenue: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },

    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    txIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    txMeta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    txAmount: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
    },
    emptyText: { ...typography.body, color: c.textMuted },

    skCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    skLegendRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    skRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    skRowDivider: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },
  });