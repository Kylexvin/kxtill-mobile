// src/screens/branches/BranchesScreen.jsx
//
// v4 — currency via settings context.
//   - Reads `formatCurrency` from useSettings(). No 'KES' fallback, no
//     activeOrganization.currency duplication, no fmt() + manual prefix.
//   - Drops `currency` prop from FloatingHeader, BranchCard, SingleBranch.
//   - All other layout, skeleton, cache, animation, and race handling
//     unchanged from v3.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { ROUTES } from '../../constants/routes';
import {
  readBranchesListCache,
  writeBranchesListCache,
} from '../../cache/cache';

/* ── utils ─────────────────────────────────────────────────────── */

const PERIOD = 'today';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const todayLabel = () => {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

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

function HeaderSkeleton({ styles, insets }) {
  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Sk width={36} height={36} r={18} />
          <Sk width={36} height={36} r={12} />
        </View>
        <Sk width={110} height={26} r={13} />
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

function BranchesSkeleton({ styles, insets }) {
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
            <Sk width={130} height={11} r={5} />
            <View style={styles.skCard}>
              <Sk width="65%" height={28} r={8} />
              <Sk width="100%" height={8} r={4} style={{ marginTop: 14 }} />
              <Sk width="50%" height={11} r={5} style={{ marginTop: 12 }} />
            </View>
          </View>

          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skBranchCard}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Sk width={42} height={42} r={14} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Sk width="60%" height={14} r={6} />
                  <Sk width="40%" height={10} r={5} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Sk width={70} height={14} r={6} />
                  <Sk width={40} height={10} r={5} />
                </View>
              </View>
              <Sk width="100%" height={4} r={2} style={{ marginTop: 12 }} />
            </View>
          ))}
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
  orgName,
  branchCount,
  totalRevenue,
  totalSales,
  isOrgWide,
  single,
  onBack,
  onOpenSales,
}) {
  const { formatCurrency, getCurrency } = useSettings();
  const title = single || !isOrgWide ? 'Your branch' : 'Branches';
  const currencyLabel = getCurrency();

  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View pointerEvents="none" style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>

          <View style={styles.monogramSmall}>
            <Ionicons name="storefront" size={16} color={c.textOnPrimary} />
          </View>
        </View>

        <View style={[styles.statusChip, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="calendar-outline" size={11} color={c.primary} />
          <Text style={[styles.statusText, { color: c.primary }]}>
            Today · {todayLabel()}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {orgName || 'Business'}
            {branchCount > 1 ? ` · ${branchCount} branches` : ''}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.revKicker}>TOTAL</Text>
          <Text
            style={styles.revValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(totalRevenue)}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="storefront-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{branchCount}</Text>
          <Text style={styles.statChipLabel}>branches</Text>
        </View>
        <Pressable
          onPress={onOpenSales}
          style={styles.statChip}
          accessibilityRole="button"
        >
          <Ionicons name="receipt-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{totalSales}</Text>
          <Text style={styles.statChipLabel}>sales</Text>
        </Pressable>
        <View style={styles.statChip}>
          <Ionicons name="bar-chart-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {branchCount > 0
              ? formatCurrency(totalRevenue / branchCount)
              : '—'}
          </Text>
          <Text style={styles.statChipLabel}>avg</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionPrimary}
          onPress={onOpenSales}
          accessibilityRole="button"
        >
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={c.textOnPrimary}
          />
          <Text style={styles.actionPrimaryText}>Ranking</Text>
        </Pressable>
        <View style={styles.actionSecondary}>
          <Ionicons name="refresh-outline" size={14} color={c.link} />
          <Text style={styles.actionSecondaryText}>Pull to refresh</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Branch card ─────────────────────────────────────────────── */

const BranchCard = memo(function BranchCard({
  b,
  index,
  rank,
  share,
  perms,
  styles,
  c,
  animate,
  onPress,
}) {
  const { formatCurrency } = useSettings();
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index, animate]);

  const lead = rank === 0 && perms.revenue && Number(b.revenue) > 0;
  const hasLow = perms.inventory && b.lowStockItems > 0;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: animate
          ? [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ]
          : [],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${b.name}`}
      >
        <View style={styles.row}>
          <View style={[styles.tile, lead && styles.tileLead]}>
            <Text style={[styles.tileText, lead && styles.tileTextLead]}>
              {(b.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {b.name}
              </Text>
              {lead ? (
                <View style={styles.topBadge}>
                  <Ionicons name="flame" size={10} color={c.textOnPrimary} />
                  <Text style={styles.topBadgeText}>TOP</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              {perms.members ? (
                <Text style={styles.meta}>{b.activeUsers} active</Text>
              ) : null}
              {hasLow ? (
                <View style={styles.lowChip}>
                  <Ionicons
                    name="alert-circle"
                    size={12}
                    color={c.warning}
                  />
                  <Text style={styles.lowText}>{b.lowStockItems} low</Text>
                </View>
              ) : perms.inventory ? (
                <Text style={styles.meta}>Stock OK</Text>
              ) : null}
              {!perms.members && !perms.inventory ? (
                <Text style={styles.meta}>Tap to open</Text>
              ) : null}
            </View>
          </View>

          {perms.revenue ? (
            <View style={styles.right}>
              <Text style={styles.rev} numberOfLines={1}>
                {formatCurrency(b.revenue)}
              </Text>
              <Text style={styles.tx}>
                {b.transactions} {b.transactions === 1 ? 'sale' : 'sales'}
              </Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          )}
        </View>

        {perms.revenue ? (
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.max(share, 2)}%` }]}
            />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

/* ── Single-branch hero ──────────────────────────────────────── */

function SingleBranch({ b, perms, styles, c, animate, onPress }) {
  const { formatCurrency } = useSettings();
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, animate]);

  const tx = Number(b.transactions) || 0;
  const rev = Number(b.revenue) || 0;
  const low = Number(b.lowStockItems) || 0;

  const tiles = [];
  if (perms.revenue) {
    tiles.push({
      key: 'avg',
      icon: 'pricetag-outline',
      value: tx > 0 ? formatCurrency(rev / tx) : '—',
      label: 'Average sale',
    });
    tiles.push({
      key: 'tx',
      icon: 'bag-handle-outline',
      value: String(tx),
      label: tx === 1 ? 'Sale today' : 'Sales today',
    });
  }
  if (perms.members) {
    tiles.push({
      key: 'users',
      icon: 'people-outline',
      value: String(b.activeUsers ?? 0),
      label: 'Active staff',
    });
  }
  if (perms.inventory) {
    tiles.push({
      key: 'stock',
      icon: low > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline',
      value: low > 0 ? String(low) : 'All good',
      label: low > 0 ? 'Low stock items' : 'Stock levels',
      tone: low > 0 ? c.warning : c.success,
    });
  }

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: animate
          ? [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ]
          : [],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.heroCard,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${b.name}`}
      >
        <View pointerEvents="none" style={styles.heroGlow} />

        <View style={styles.row}>
          <View style={[styles.tile, styles.tileLead, styles.heroTile]}>
            <Text
              style={[
                styles.tileText,
                styles.tileTextLead,
                { fontSize: 22 },
              ]}
            >
              {(b.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroName} numberOfLines={1}>
              {b.name}
            </Text>
            <Text style={styles.heroTag}>Your branch</Text>
          </View>
        </View>

        {perms.revenue ? (
          <View style={styles.heroSales}>
            <Text style={styles.sumLabel}>SALES TODAY</Text>
            <Text
              style={styles.heroValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(rev)}
            </Text>
          </View>
        ) : null}

        <View style={styles.openBtn}>
          <Text style={styles.openBtnText}>Open workspace</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={c.textOnPrimary}
          />
        </View>
      </Pressable>

      {tiles.length > 0 ? (
        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable
              key={t.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.statTile,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.statIcon}>
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={t.tone || c.link}
                />
              </View>
              <Text
                style={[
                  styles.statValue,
                  t.tone ? { color: t.tone } : null,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t.value}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Screen ──────────────────────────────────────────────────── */

export default function BranchesScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { formatCurrency } = useSettings();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

  const hasEnteredRef = useRef(false);
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
      if (!orgId) {
        setData(null);
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else if (dataRef.current == null) setLoading(true);
      setError(null);

      if (dataRef.current == null) {
        const cached = await readBranchesListCache(orgId, PERIOD);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const { api } = await import('../../services/api');
        const res = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/mobile/branches`,
          { params: { period: PERIOD } }
        );
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const payload = res.data?.data || null;
        setData(payload);
        setStaleError(null);
        writeBranchesListCache(orgId, PERIOD, payload);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load branches';
        if (dataRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOrganization?.id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const perms = useMemo(
    () => ({
      revenue: data?.scope?.canSeeRevenue !== false,
      inventory: data?.scope?.canSeeInventory !== false,
      members: data?.scope?.canSeeMembers !== false,
    }),
    [data?.scope]
  );
  const isOrgWide = data?.scope?.isOrgWide === true;

  const branches = useMemo(() => {
    const list = data?.branches || [];
    return perms.revenue
      ? [...list].sort(
          (a, b) =>
            (Number(b.revenue) || 0) - (Number(a.revenue) || 0)
        )
      : list;
  }, [data, perms.revenue]);

  const totalRevenue = useMemo(
    () => branches.reduce((s, b) => s + (Number(b.revenue) || 0), 0),
    [branches]
  );
  const totalSales = useMemo(
    () => branches.reduce((s, b) => s + (Number(b.transactions) || 0), 0),
    [branches]
  );
  const maxRev = Number(branches[0]?.revenue) || 0;
  const showSummary =
    isOrgWide && perms.revenue && branches.length > 1 && totalRevenue > 0;
  const single = branches.length === 1;
  const leadPct =
    totalRevenue > 0
      ? Math.round((Number(branches[0]?.revenue) / totalRevenue) * 100)
      : 0;

  const shouldAnimate = !hasEnteredRef.current;
  useEffect(() => {
    if (data && !hasEnteredRef.current) {
      hasEnteredRef.current = true;
    }
  }, [data]);

  const open = useCallback(
    (b) =>
      navigation.navigate(ROUTES.BRANCH_HOME, {
        branchId: b.id,
        branchName: b.name,
      }),
    [navigation]
  );

  if (loading && !data && !error) {
    return <BranchesSkeleton styles={styles} insets={insets} />;
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
            colors={[c.primary]}
          />
        }
      >
        <FloatingHeader
          c={c}
          styles={styles}
          insets={insets}
          orgName={activeOrganization?.name}
          branchCount={branches.length}
          totalRevenue={totalRevenue}
          totalSales={totalSales}
          isOrgWide={isOrgWide}
          single={single}
          onBack={() => navigation.goBack()}
          onOpenSales={() => {}}
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
          {showSummary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.sumLabel}>TODAY ACROSS BRANCHES</Text>
              <Text style={styles.sumValue} numberOfLines={1}>
                {formatCurrency(totalRevenue)}
              </Text>
              <View style={styles.segBar}>
                {branches.slice(0, 6).map((b, i) => (
                  <View
                    key={b.id}
                    style={[
                      styles.seg,
                      {
                        flex: Math.max(
                          Number(b.revenue) || 0,
                          totalRevenue * 0.02
                        ),
                        opacity: Math.max(0.25, 1 - i * 0.2),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.sumNote} numberOfLines={1}>
                {branches[0].name} leads with {leadPct}%
              </Text>
            </View>
          ) : null}

          {single ? (
            <SingleBranch
              b={branches[0]}
              perms={perms}
              styles={styles}
              c={c}
              animate={shouldAnimate}
              onPress={() => open(branches[0])}
            />
          ) : null}

          {!single
            ? branches.map((b, i) => (
                <BranchCard
                  key={b.id}
                  b={b}
                  index={i}
                  rank={i}
                  share={
                    maxRev > 0
                      ? ((Number(b.revenue) || 0) / maxRev) * 100
                      : 0
                  }
                  perms={perms}
                  styles={styles}
                  c={c}
                  animate={shouldAnimate}
                  onPress={() => open(b)}
                />
              ))
            : null}

          {!error && branches.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="storefront-outline"
                size={28}
                color={c.textMuted}
              />
              <Text style={styles.emptyTitle}>No branches yet</Text>
              <Text style={styles.emptySub}>
                Branches you can access will show up here.
              </Text>
            </View>
          ) : null}

          {single && isOrgWide ? (
            <View style={styles.tip}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={c.link}
              />
              <Text style={styles.tipText}>
                Opening another branch? It will show up here, ranked by
                sales, with a share-of-revenue chart.
              </Text>
            </View>
          ) : null}

          {!isOrgWide && single ? (
            <Text style={styles.hint}>
              Ask the owner to assign you to more branches if you need
              access to others.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1, minWidth: 0 },
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

    // Summary
    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    sumLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
    },
    sumValue: {
      color: c.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -1,
      marginTop: 6,
      fontVariant: ['tabular-nums'],
    },
    segBar: {
      flexDirection: 'row',
      gap: 3,
      height: 8,
      marginTop: 12,
      borderRadius: 4,
      overflow: 'hidden',
    },
    seg: { backgroundColor: c.primary, borderRadius: 3 },
    sumNote: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },

    // Branch card
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tile: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLead: { backgroundColor: c.primary },
    tileText: { color: c.link, fontSize: 18, fontWeight: '900' },
    tileTextLead: { color: c.textOnPrimary },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: {
      flexShrink: 1,
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    topBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 999,
      backgroundColor: c.primary,
    },
    topBadgeText: {
      color: c.textOnPrimary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    meta: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    lowChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    lowText: { color: c.warning, fontSize: 12, fontWeight: '700' },

    right: { alignItems: 'flex-end' },
    rev: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    tx: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },

    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginTop: 12,
      overflow: 'hidden',
    },
    fill: { height: 4, borderRadius: 2, backgroundColor: c.primary },

    // Single branch hero
    heroCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -100,
      right: -80,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: c.primary,
      opacity: 0.12,
    },
    heroTile: { width: 52, height: 52, borderRadius: 17 },
    heroName: {
      color: c.textPrimary,
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    heroTag: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    heroSales: { marginTop: 22 },
    heroValue: {
      color: c.textPrimary,
      fontSize: 40,
      lineHeight: 46,
      fontWeight: '900',
      letterSpacing: -1.5,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    openBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: c.primary,
    },
    openBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '800' },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    statTile: {
      flexGrow: 1,
      flexBasis: '47%',
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
    },
    tipText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '500',
    },

    empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 6,
    },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    hint: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
      lineHeight: 18,
    },

    // Skeleton only
    skCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    skBranchCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    section: { marginTop: spacing.md },
  });