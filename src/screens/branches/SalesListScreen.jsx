// src/screens/branches/SalesListScreen.jsx
//
// Completed sales for the active branch. Tap a row → ReceiptScreen.
//
// v2 — full rebuild:
//   - Floating header card: back + monogram + "N sales" status, identity,
//     three stat chips (total / today / week), search bar, filter pills.
//   - Debounced search filters by reference, customer, cashier, amount.
//   - Filter chips: All / Today / This week.
//   - Grouped by date: "TODAY" / "EARLIER".
//   - Skeleton on first load; stale chip on refresh failure.
//   - Cache per (orgId, branchId) — 5 min TTL, stale-first.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Animated,
  SectionList,
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
import { ROUTES } from '../../constants/routes';
import { api } from '../../services/api';
import { readRow, writeRow } from '../../cache/db';

/* ── cache ──────────────────────────────────────────────────── */

function salesKey(orgId, branchId) {
  return `sales-list:${orgId}:${branchId || 'all'}`;
}

async function readSalesCache(orgId, branchId) {
  if (!orgId) return null;
  const row = await readRow('settings_cache', {
    org_id: salesKey(orgId, branchId),
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeSalesCache(orgId, branchId, payload) {
  if (!orgId) return;
  await writeRow('settings_cache', {
    org_id: salesKey(orgId, branchId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── utils ──────────────────────────────────────────────────── */

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function fmtDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── skeleton ───────────────────────────────────────────────── */

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

function SalesListSkeleton({ styles, insets }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Sk width={36} height={36} r={18} />
            <Sk width={36} height={36} r={12} />
          </View>
          <Sk width={90} height={24} r={12} />
        </View>
        <View style={{ marginTop: 8 }}>
          <Sk width="55%" height={22} r={8} />
          <Sk width="40%" height={13} r={6} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.chipRow}>
          <Sk width="31%" height={32} r={12} />
          <Sk width="31%" height={32} r={12} />
          <Sk width="31%" height={32} r={12} />
        </View>
        <Sk width="100%" height={44} r={12} style={{ marginTop: 14 }} />
        <View style={styles.filterRow}>
          <Sk width="31%" height={34} r={10} />
          <Sk width="31%" height={34} r={10} />
          <Sk width="31%" height={34} r={10} />
        </View>
      </View>

      <View style={styles.body}>
        <Sk width={90} height={11} r={5} style={{ marginBottom: 8 }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.card}>
            <Sk width={40} height={40} r={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Sk width="60%" height={14} r={6} />
              <Sk width="40%" height={10} r={5} />
            </View>
            <Sk width={70} height={14} r={6} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

/* ── screen ─────────────────────────────────────────────────── */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
];

export default function SalesListScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, activeBranch } = useOrganizationContext();
  const { getCurrency, formatCurrency } = useSettings();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

  const [search, setSearch] = useState('');
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
    dataRef.current = sales;
  }, [sales]);

  const load = useCallback(
    async (isRefresh = false) => {
      const orgId = activeOrganization?.id;
      const branchId = activeBranch?.id;
      if (!orgId) {
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else if (dataRef.current == null || dataRef.current.length === 0) {
        setLoading(true);
      }
      setError(null);

      if (isRefresh === false && dataRef.current === null) {
        const cached = await readSalesCache(orgId, branchId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setSales(cached.payload || []);
          setLoading(false);
        }
      }

      try {
        const params = { status: 'COMPLETED', limit: 50 };
        if (branchId) params.branchId = branchId;

        const { data } = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/sales`,
          { params }
        );

        const list = Array.isArray(data?.sales)
          ? data.sales
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setSales(list);
        setStaleError(null);
        writeSalesCache(orgId, branchId, list);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load sales';
        if (dataRef.current != null && dataRef.current.length > 0) {
          setStaleError(message);
        } else {
          setError(message);
        }
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOrganization?.id, activeBranch?.id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  /* ── derived ─────────────────────────────────────────────── */

  const now = Date.now();
  const dayStart = startOfDay();
  const weekStart = startOfWeek();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (filter === 'today') {
        const t = new Date(s.createdAt).getTime();
        if (!(t >= dayStart && t <= now)) return false;
      } else if (filter === 'week') {
        const t = new Date(s.createdAt).getTime();
        if (!(t >= weekStart && t <= now)) return false;
      }
      if (!q) return true;
      const ref = String(s.reference || s.id || '').toLowerCase();
      const cust = String(s.customerName || '').toLowerCase();
      const cashier = String(s.cashierName || s.user || '').toLowerCase();
      const amt = String(s.totalAmount || s.total || '');
      return (
        ref.includes(q) ||
        cust.includes(q) ||
        cashier.includes(q) ||
        amt.includes(q)
      );
    });
  }, [sales, search, filter, dayStart, weekStart, now]);

  const sections = useMemo(() => {
    const today = [];
    const earlier = [];
    for (const s of filtered) {
      const t = new Date(s.createdAt).getTime();
      if (t >= dayStart) today.push(s);
      else earlier.push(s);
    }
    const out = [];
    if (today.length) out.push({ title: 'TODAY', data: today });
    if (earlier.length) out.push({ title: 'EARLIER', data: earlier });
    return out;
  }, [filtered, dayStart]);

  const totalToday = useMemo(
    () =>
      sales
        .filter((s) => {
          const t = new Date(s.createdAt).getTime();
          return t >= dayStart && t <= now;
        })
        .reduce(
          (sum, s) => sum + Number(s.totalAmount || s.total || 0),
          0
        ),
    [sales, dayStart, now]
  );

  const totalWeek = useMemo(
    () =>
      sales
        .filter((s) => {
          const t = new Date(s.createdAt).getTime();
          return t >= weekStart && t <= now;
        })
        .reduce(
          (sum, s) => sum + Number(s.totalAmount || s.total || 0),
          0
        ),
    [sales, weekStart, now]
  );

  const todayCount = useMemo(
    () =>
      sales.filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= dayStart && t <= now;
      }).length,
    [sales, dayStart, now]
  );

  const amountOf = (s) => Number(s.totalAmount || s.total || 0);

  /* ── render ──────────────────────────────────────────────── */

  if (loading && sales.length === 0 && !error) {
    return <SalesListSkeleton styles={styles} insets={insets} />;
  }

  const branchName = activeBranch?.name || 'All branches';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={c.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Floating header */}
            <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
              <View pointerEvents="none" style={styles.headerGlow} />

              <View style={styles.headerTop}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {/* <Pressable
                    onPress={() => navigation.goBack()}
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
                  </Pressable> */}
                  <View style={styles.monogramSmall}>
                    <Text style={styles.monogramSmallText}>
                      {(branchName || 'R').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: c.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={11}
                    color={c.primary}
                  />
                  <Text style={[styles.statusText, { color: c.primary }]}>
                    {sales.length} {sales.length === 1 ? 'sale' : 'sales'}
                  </Text>
                </View>
              </View>

              <View style={styles.identityRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.headerName} numberOfLines={1}>
                    Receipts
                  </Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {branchName}
                  </Text>
                </View>
              </View>

              <View style={styles.chipRow}>
                <View style={styles.statChip}>
                  <Ionicons
                    name="receipt-outline"
                    size={13}
                    color={c.link}
                  />
                  <Text style={styles.statChipValue}>
                    {sales.length}
                  </Text>
                  <Text style={styles.statChipLabel}>total</Text>
                </View>
                <View style={styles.statChip}>
                  <Ionicons
                    name="today-outline"
                    size={13}
                    color={c.success}
                  />
                  <Text
                    style={[
                      styles.statChipValue,
                      { color: c.success },
                    ]}
                  >
                    {todayCount}
                  </Text>
                  <Text style={styles.statChipLabel}>today</Text>
                </View>
                <View style={styles.statChip}>
                  <Ionicons
                    name="cash-outline"
                    size={13}
                    color={c.link}
                  />
                  <Text
                    style={styles.statChipValue}
                    numberOfLines={1}
                  >
                    {formatCurrency(totalWeek)}
                  </Text>
                  <Text style={styles.statChipLabel}>week</Text>
                </View>
              </View>

              <View style={styles.headerRule} />

              {/* Search */}
              <View style={styles.searchBar}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={c.textMuted}
                />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search ref, customer, amount"
                  placeholderTextColor={c.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  selectionColor={c.primary}
                />
                {search.length > 0 ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={c.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>

              {/* Filters */}
              <View style={styles.filterRow}>
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setFilter(f.id)}
                      style={[
                        styles.filterPill,
                        active && styles.filterPillActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          active && styles.filterTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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

            {sales.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="receipt-outline"
                  size={40}
                  color={c.textMuted}
                />
                <Text style={styles.emptyTitle}>No completed sales</Text>
                <Text style={styles.emptyText}>
                  Once a sale is completed, it shows up here for sharing.
                </Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={40}
                  color={c.textMuted}
                />
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyText}>
                  Try a different search or filter.
                </Text>
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) =>
          section.data.length > 0 ? (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate(ROUTES.BRANCH_RECEIPT, {
                saleId: item.id,
              })
            }
          >
            <View style={styles.receiptIcon}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={c.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ref} numberOfLines={1}>
                {item.reference || item.id?.slice(0, 8)}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {fmtDateFull(item.createdAt)}
                {item.customerName ? ` · ${item.customerName}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount} numberOfLines={1}>
                {formatCurrency(amountOf(item))}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.branchName || item.branch?.name || ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxl },
    body: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },

    // Floating header card
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
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: c.surfaceElevated,
    },
    statChipValue: {
      color: c.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    statChipLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },

    headerRule: {
      height: 1,
      backgroundColor: c.border,
      marginTop: 16,
      marginBottom: 12,
    },

    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.background,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      minHeight: 42,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      paddingVertical: 8,
    },

    // Filter pills
    filterRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    filterPill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
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
      fontSize: 12,
    },
    filterTextActive: { color: c.textOnPrimary },

    // Stale / error
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

    // Sections + rows
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xl,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    receiptIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ref: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    meta: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    amount: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.md,
    },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      maxWidth: 280,
    },
  });