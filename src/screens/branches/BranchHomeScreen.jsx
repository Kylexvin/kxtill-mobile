// src/screens/branches/BranchHomeScreen.jsx
//
// v5 — currency via settings context.
//   - Reads formatCurrency / getCurrency from useSettings().
//   - Drops `currency` prop from FloatingHeader.
//   - All other layout, skeleton, cache, and race handling unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { ROUTES } from '../../constants/routes';
import branchesService from '../../services/branches.service';
import {
  readBranchHomeCache,
  writeBranchHomeCache,
} from '../../cache/cache';

/* ── utils ─────────────────────────────────────────────────────── */

const PERIOD = 'today';

const SAFE_ICONS = new Set([
  'receipt-outline', 'cube-outline', 'time-outline', 'settings-outline',
  'people-outline', 'person-outline', 'card-outline', 'cash-outline',
  'wallet-outline', 'bar-chart-outline', 'stats-chart-outline',
  'swap-horizontal-outline', 'ellipse-outline', 'arrow-up', 'arrow-down',
  'chevron-forward', 'checkmark-circle-outline', 'alert-circle-outline',
]);
const safeIcon = (name, fallback = 'ellipse-outline') =>
  SAFE_ICONS.has(name) ? name : fallback;

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
        <Sk width={70} height={24} r={12} />
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

function BranchHomeSkeleton({ styles, insets }) {
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
              <View style={styles.trendBars}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <View key={i} style={styles.trendCol}>
                    <Sk width="70%" height={40} r={4} />
                  </View>
                ))}
              </View>
            </View>
          </View>

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
            <Sk width={100} height={11} r={5} />
            <View style={styles.skCard}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.skProductRow, i > 0 && styles.skRowDivider]}
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
            <Sk width={100} height={11} r={5} />
            <View style={styles.tileGrid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skTile}>
                  <Sk width={36} height={36} r={10} />
                  <Sk width={80} height={12} r={6} style={{ marginTop: 10 }} />
                  <Sk width="90%" height={10} r={5} style={{ marginTop: 6 }} />
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
  c, styles, insets, branch, branchName, orgName,
  canSeeRevenue, canSeeInventory, canSeeMembers,
  onBack, onOpenSales, onOpenStock,
}) {
  const { formatCurrency } = useSettings();
  const monogram =
    (branch?.name || branchName || 'B').trim().charAt(0).toUpperCase();

  const delta = branch?.deltaPct;
  const hasDelta = delta != null && Number.isFinite(Number(delta));
  const up = hasDelta && Number(delta) >= 0;
  const isActive = branch?.isActive !== false;

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
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </TouchableOpacity>
          <View style={styles.monogramSmall}>
            <Text style={styles.monogramSmallText}>{monogram}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusChip,
            { backgroundColor: isActive ? c.primarySoft : c.surfaceElevated },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? c.success : c.textMuted },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isActive ? c.primary : c.textMuted },
            ]}
          >
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {branch?.name || branchName || 'Branch'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {orgName || 'Business'} · Today
          </Text>
        </View>

        {canSeeRevenue ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.revKicker}>REVENUE</Text>
            <Text
              style={styles.revValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(branch?.revenue)}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.revKicker}>REVENUE</Text>
            <Text style={styles.hiddenNote}>Hidden</Text>
          </View>
        )}
      </View>

      {hasDelta && canSeeRevenue ? (
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
        {canSeeRevenue && branch ? (
          <Pressable
            onPress={onOpenSales}
            style={styles.statChip}
            accessibilityRole="button"
          >
            <Ionicons name="receipt-outline" size={13} color={c.link} />
            <Text style={styles.statChipValue} numberOfLines={1}>
              {branch.transactions}
            </Text>
            <Text style={styles.statChipLabel} numberOfLines={1}>
              sales
            </Text>
          </Pressable>
        ) : (
          <View style={styles.statChip}>
            <Ionicons name="receipt-outline" size={13} color={c.textMuted} />
            <Text style={[styles.statChipValue, { color: c.textMuted }]}>—</Text>
            <Text style={styles.statChipLabel}>sales</Text>
          </View>
        )}

        {canSeeMembers && branch ? (
          <View style={styles.statChip}>
            <Ionicons name="people-outline" size={13} color={c.link} />
            <Text style={styles.statChipValue} numberOfLines={1}>
              {branch.activeUsers}
            </Text>
            <Text style={styles.statChipLabel} numberOfLines={1}>
              staff
            </Text>
          </View>
        ) : (
          <View style={styles.statChip}>
            <Ionicons name="people-outline" size={13} color={c.textMuted} />
            <Text style={[styles.statChipValue, { color: c.textMuted }]}>—</Text>
            <Text style={styles.statChipLabel}>staff</Text>
          </View>
        )}

        {canSeeInventory && branch ? (
          <Pressable
            onPress={onOpenStock}
            style={styles.statChip}
            accessibilityRole="button"
          >
            <Ionicons
              name="cube-outline"
              size={13}
              color={branch.lowStockItems > 0 ? c.warning : c.link}
            />
            <Text
              style={[
                styles.statChipValue,
                branch.lowStockItems > 0 && { color: c.warning },
              ]}
              numberOfLines={1}
            >
              {branch.lowStockItems}
            </Text>
            <Text style={styles.statChipLabel} numberOfLines={1}>
              low
            </Text>
          </Pressable>
        ) : (
          <View style={styles.statChip}>
            <Ionicons name="cube-outline" size={13} color={c.textMuted} />
            <Text style={[styles.statChipValue, { color: c.textMuted }]}>—</Text>
            <Text style={styles.statChipLabel}>low</Text>
          </View>
        )}
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={onOpenSales}
          activeOpacity={0.85}
          disabled={!canSeeRevenue}
          accessibilityRole="button"
        >
          <Ionicons
            name="receipt-outline"
            size={14}
            color={c.textOnPrimary}
          />
          <Text style={styles.actionPrimaryText}>View sales</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionSecondary}
          onPress={onOpenStock}
          activeOpacity={0.85}
          disabled={!canSeeInventory}
          accessibilityRole="button"
        >
          <Ionicons name="cube-outline" size={14} color={c.link} />
          <Text style={styles.actionSecondaryText}>View stock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────── */

export default function BranchHomeScreen({ route }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
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
        const cached = await readBranchHomeCache(orgId, branchId, PERIOD);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const res = await branchesService.getBranchDetail(
          orgId,
          branchId,
          PERIOD
        );
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(res);
        setStaleError(null);
        writeBranchHomeCache(orgId, branchId, PERIOD, res);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load branch';
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

  const branch = data?.branch;
  const canSeeRevenue = data?.scope?.canSeeRevenue === true;
  const canSeeInventory = data?.scope?.canSeeInventory === true;
  const canSeeMembers = data?.scope?.canSeeMembers === true;

  const openSales = useCallback(
    () =>
      navigation.navigate(ROUTES.BRANCH_SALES, {
        branchId,
        branchName: branch?.name || branchName,
      }),
    [navigation, branchId, branchName, branch?.name]
  );

  const openStock = useCallback(
    () =>
      navigation.navigate(ROUTES.BRANCH_STOCK, {
        branchId,
        branchName: branch?.name || branchName,
      }),
    [navigation, branchId, branchName, branch?.name]
  );

  const tiles = useMemo(() => {
    const list = [];
    if (canSeeRevenue) {
      list.push({
        id: 'sales',
        label: 'Sales',
        description: 'Recent transactions & top products',
        icon: 'receipt-outline',
        onPress: openSales,
      });
    }
    if (canSeeInventory) {
      list.push({
        id: 'stock',
        label: 'Stock',
        description: 'Low and out of stock',
        icon: 'cube-outline',
        onPress: openStock,
      });
    }
    list.push({
      id: 'shifts',
      label: 'Shifts',
      description: 'Current and recent shifts',
      icon: 'time-outline',
      onPress: () =>
        navigation.navigate(ROUTES.BRANCH_SHIFTS, {
          branchId,
          branchName: branch?.name || branchName,
        }),
    });
    list.push({
      id: 'settings',
      label: 'Branch settings',
      description: 'Shifts, variance, credit',
      icon: 'settings-outline',
      onPress: () =>
        navigation.navigate(ROUTES.BRANCH_SETTINGS, {
          branchId,
          branchName: branch?.name || branchName,
        }),
    });
    return list;
  }, [
    canSeeRevenue, canSeeInventory, branchId, branchName,
    branch?.name, navigation, openSales, openStock,
  ]);

  const trendValues = data?.trend?.values || [];
  const trendMax = Math.max(...trendValues, 1);
  const payColor = (id) =>
    id === 'mpesa' ? c.success : id === 'cash' ? c.primary : c.textMuted;

  if (loading && !data && !error) {
    return <BranchHomeSkeleton styles={styles} insets={insets} />;
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
          branch={branch}
          branchName={branchName}
          orgName={activeOrganization?.name}
          canSeeRevenue={canSeeRevenue}
          canSeeInventory={canSeeInventory}
          canSeeMembers={canSeeMembers}
          onBack={() => navigation.goBack()}
          onOpenSales={openSales}
          onOpenStock={openStock}
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
          {canSeeRevenue && trendValues.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
              <View style={styles.card}>
                <View style={styles.trendBars}>
                  {trendValues.map((v, i) => {
                    const h = Math.max(6, Math.round((v / trendMax) * 64));
                    return (
                      <View key={i} style={styles.trendCol}>
                        <View style={[styles.trendBar, { height: h }]} />
                        <Text style={styles.trendLabel} numberOfLines={1}>
                          {data.trend.labels[i]?.split(' ')[0] || ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {canSeeRevenue && data?.payments?.methods?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PAYMENT MIX</Text>
              <View style={styles.card}>
                <View style={styles.mixBar}>
                  {data.payments.methods.map((p) => (
                    <View
                      key={p.id}
                      style={{ flex: p.pct, backgroundColor: payColor(p.id) }}
                    />
                  ))}
                </View>
                <View style={styles.mixLegend}>
                  {data.payments.methods.map((p) => (
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

          {canSeeRevenue && data?.products?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TOP PRODUCTS</Text>
              <View style={styles.card}>
                {data.products.map((p, i) => (
                  <View
                    key={p.id || p.name}
                    style={[styles.productRow, i > 0 && styles.rowDivider]}
                  >
                    <Text style={styles.productRank}>{i + 1}</Text>
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

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXPLORE</Text>
            <View style={styles.tileGrid}>
              {tiles.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.tile}
                  activeOpacity={0.8}
                  onPress={t.onPress}
                  accessibilityRole="button"
                >
                  <View style={styles.tileIcon}>
                    <Ionicons
                      name={safeIcon(t.icon)}
                      size={20}
                      color={c.primary}
                    />
                  </View>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <Text style={styles.tileDesc} numberOfLines={2}>
                    {t.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
      letterSpacing: -0.3,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
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
    hiddenNote: {
      color: c.textMuted,
      fontSize: 14,
      fontStyle: 'italic',
      marginTop: 4,
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

    trendBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 90,
      gap: 4,
    },
    trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    trendBar: {
      width: '70%',
      backgroundColor: c.primary,
      borderRadius: 4,
      opacity: 0.75,
    },
    trendLabel: {
      ...typography.caption,
      color: c.textMuted,
      fontSize: 10,
      marginTop: 6,
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
    productRank: {
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

    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tile: {
      width: '48%',
      minHeight: 130,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 14 },
    tileDesc: { ...typography.caption, color: c.textMuted, lineHeight: 16 },

    skCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    skLegendRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    skProductRow: {
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
    skTile: {
      width: '48%',
      minHeight: 130,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
  });