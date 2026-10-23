// src/screens/branches/BranchStockScreen.jsx
//
// Branch stock detail. Low-stock and out-of-stock items for this branch.
//
// v3 — skeleton rebuilt 1:1 with the real layout:
//   - Every block height matches its real counterpart exactly. No shift on
//     data arrival.
//   - Empty-result path renders the real empty state, not a skeleton.
//   - Body sections use the same `styles.section` as real content.
//   - Item list uses `gap` on the wrapping View, not per-card margins.
//
// Everything else from v2 preserved: floating header, cache via
// settings_cache, stale chip, race-token guard.

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
import branchesService from '../../services/branches.service';
import { readRow, writeRow } from '../../cache/db';

/* ── cache helpers ──────────────────────────────────────────── */

function stockKey(orgId, branchId) {
  return `stock:${orgId}:${branchId}`;
}

async function readBranchStockCache(orgId, branchId) {
  if (!orgId || !branchId) return null;
  const row = await readRow('settings_cache', {
    org_id: stockKey(orgId, branchId),
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeBranchStockCache(orgId, branchId, payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('settings_cache', {
    org_id: stockKey(orgId, branchId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── constants ──────────────────────────────────────────────── */

const FILTERS = [
  { id: 'all', label: 'All', icon: 'list-outline' },
  { id: 'out', label: 'Out', icon: 'alert-circle-outline' },
  { id: 'low', label: 'Low', icon: 'warning-outline' },
];

/* ── Skeleton primitive ─────────────────────────────────────── */

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

/* ── Header skeleton — pixel-identical geometry to the real header ── */

function HeaderSkeleton({ styles, insets, c }) {
  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      {/* top row: back (36) + monogram (36) left, status chip right */}
      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Sk width={36} height={36} r={18} />
          <Sk width={36} height={36} r={12} />
        </View>
        <Sk width={110} height={24} r={12} />
      </View>

      {/* identity row: name (22) + sub (13) on the left */}
      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sk width="55%" height={22} r={8} />
          <Sk width="40%" height={13} r={6} style={{ marginTop: 3 }} />
        </View>
      </View>

      {/* chip row: three chips, each 32 tall, gap 8, marginTop 14 */}
      <View style={styles.chipRow}>
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
      </View>

      {/* rule: 1px, mt 16, mb 14 */}
      <View style={styles.headerRule} />

      {/* filter row: three pills, each 40 tall, gap 8 */}
      <View style={styles.filterRow}>
        <Sk width="31%" height={40} r={12} />
        <Sk width="31%" height={40} r={12} />
        <Sk width="31%" height={40} r={12} />
      </View>
    </View>
  );
}

/* ── Body skeleton — same `styles.section` and `styles.list` as real ─ */

function BodySkeleton({ styles }) {
  return (
    <View style={styles.section}>
      {/* "ISSUES" label placeholder — real label height is ~14px */}
      <Sk width={80} height={11} r={5} style={{ marginBottom: spacing.sm }} />

      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.itemCard}>
            <Sk width={34} height={34} r={10} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Sk width="60%" height={14} r={6} />
              <Sk
                width="35%"
                height={11}
                r={5}
                style={{ marginTop: 2 }}
              />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Sk width={30} height={18} r={6} />
              <Sk
                width={44}
                height={11}
                r={5}
                style={{ marginTop: 1 }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BranchStockSkeleton({ styles, insets, c }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <HeaderSkeleton styles={styles} insets={insets} c={c} />
        <View style={styles.body}>
          <BodySkeleton styles={styles} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Floating header ────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  branchName,
  summary,
  filter,
  setFilter,
  onBack,
}) {
  const monogram = (branchName || 'B').trim().charAt(0).toUpperCase();
  const out = Number(summary?.outCount || 0);
  const low = Number(summary?.lowCount || 0);
  const total = Number(summary?.total || 0);

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

        <View
          style={[
            styles.statusChip,
            {
              backgroundColor:
                out > 0
                  ? c.dangerSoft
                  : low > 0
                    ? c.primarySoft
                    : c.surfaceElevated,
            },
          ]}
        >
          <Ionicons
            name={
              out > 0
                ? 'alert-circle'
                : low > 0
                  ? 'warning'
                  : 'checkmark-circle'
            }
            size={11}
            color={out > 0 ? c.danger : low > 0 ? c.warning : c.success}
          />
          <Text
            style={[
              styles.statusText,
              {
                color:
                  out > 0 ? c.danger : low > 0 ? c.warning : c.success,
              },
            ]}
          >
            {out > 0 ? 'Attention' : low > 0 ? 'Low' : 'All good'}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {branchName || 'Branch'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Stock status
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="alert-circle" size={13} color={c.danger} />
          <Text style={[styles.statChipValue, { color: c.danger }]}>
            {out}
          </Text>
          <Text style={styles.statChipLabel}>out</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="warning" size={13} color={c.warning} />
          <Text style={[styles.statChipValue, { color: c.warning }]}>
            {low}
          </Text>
          <Text style={styles.statChipLabel}>low</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="cube-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{total}</Text>
          <Text style={styles.statChipLabel}>items</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id === 'out' ? out : f.id === 'low' ? low : total;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? c.textOnPrimary : c.textSecondary}
              />
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
              {count > 0 ? (
                <Text
                  style={[
                    styles.filterCount,
                    active && styles.filterCountActive,
                  ]}
                >
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────────── */

export default function BranchStockScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [filter, setFilter] = useState('all');

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
        const cached = await readBranchStockCache(orgId, branchId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const res = await branchesService.getBranchStock(orgId, branchId);
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(res);
        setStaleError(null);
        writeBranchStockCache(orgId, branchId, res);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load stock';
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

  const items = data?.items || [];
  const filteredItems =
    filter === 'all' ? items : items.filter((i) => i.status === filter);
  const summary = data?.summary || { outCount: 0, lowCount: 0, total: 0 };
  const label = data?.branch?.name || branchName || 'Branch';

  if (loading && !data && !error) {
    return <BranchStockSkeleton styles={styles} insets={insets} c={c} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
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
          branchName={label}
          summary={summary}
          filter={filter}
          setFilter={setFilter}
          onBack={() => navigation.goBack()}
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
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="cloud-offline-outline"
              size={18}
              color={c.danger}
            />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <Pressable onPress={() => load(false)} hitSlop={8}>
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.body}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="cube-outline"
                size={40}
                color={c.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {filter === 'all'
                  ? 'All good'
                  : filter === 'out'
                    ? 'Nothing out of stock'
                    : 'Nothing low on stock'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'No stock alerts for this branch.'
                  : 'This branch has no items in this category.'}
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ISSUES</Text>
              <View style={styles.list}>
                {filteredItems.map((item) => {
                  const isOut = item.status === 'out';
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: isOut
                              ? 'rgba(229,72,77,0.15)'
                              : 'rgba(245,166,35,0.15)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={isOut ? 'alert-circle' : 'warning'}
                          size={16}
                          color={isOut ? c.danger : c.warning}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.sku ? (
                          <Text
                            style={styles.itemSku}
                            numberOfLines={1}
                          >
                            {item.sku}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.itemRight}>
                        <Text
                          style={[
                            styles.itemStock,
                            { color: isOut ? c.danger : c.warning },
                          ]}
                        >
                          {item.stock}
                        </Text>
                        <Text style={styles.itemStockLabel}>
                          /{item.minStock} {item.unit}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
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

    // Floating header
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
      fontSize: 14,
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

    filterRow: { flexDirection: 'row', gap: 8 },
    filterPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterPillActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterText: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: '700',
    },
    filterTextActive: { color: c.textOnPrimary },
    filterCount: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '800',
      fontSize: 11,
    },
    filterCountActive: { color: c.textOnPrimary },

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
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.dangerSoft,
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
    },
    errorText: {
      flex: 1,
      color: c.danger,
      fontSize: 13,
      fontWeight: '600',
    },
    retry: { color: c.danger, fontSize: 13, fontWeight: '900' },

    section: { marginTop: spacing.md },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },

    list: { gap: spacing.sm },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    statusChip: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemName: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    itemSku: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    itemRight: { alignItems: 'flex-end' },
    itemStock: {
      fontSize: 18,
      fontWeight: '800',
    },
    itemStockLabel: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '600',
      marginTop: 1,
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
    },
    emptyTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 280,
    },
  });