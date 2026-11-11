// src/screens/branches/BranchesScreen.jsx
//
// v6 — single-branch owner uses `isOwner` from PermissionsContext so the
// hint is correct regardless of backend isOrgWide. Rest unchanged.

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
import { usePermissionsContext } from '../../context/PermissionsContext';
import { ROUTES } from '../../constants/routes';
import {
  readBranchesListCache,
  writeBranchesListCache,
} from '../../cache/cache';

const PERIOD = 'today';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const todayLabel = () => {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

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

function BranchesSkeleton({ styles, insets }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={false}>
        <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
          <Sk width={120} height={26} r={8} />
          <Sk width={36} height={36} r={18} />
        </View>
        <View style={styles.statStrip}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.statStripItem}>
              <Sk width={50} height={10} r={5} />
              <Sk width={80} height={22} r={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <View style={{ paddingHorizontal: spacing.xl, marginTop: 20 }}>
          <Sk width={100} height={11} r={5} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Sk width={140} height={92} r={14} />
            <Sk width={140} height={92} r={14} />
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.xl, marginTop: 24 }}>
          <Sk width={100} height={11} r={5} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skRow}>
              <Sk width={38} height={38} r={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Sk width="55%" height={13} r={6} />
                <Sk width="35%" height={10} r={5} />
              </View>
              <Sk width={64} height={16} r={6} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ c, styles, insets, title, subtitle, onBack }) {
  return (
    <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.topSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
      </Pressable>
    </View>
  );
}

function StatStrip({ styles, stats }) {
  return (
    <View style={styles.statStrip}>
      {stats.map((s, i) => (
        <View key={s.key} style={styles.statStripItem}>
          {i > 0 ? <View style={styles.statDivider} /> : null}
          <Text style={styles.statStripLabel}>{s.label}</Text>
          <Text
            style={[styles.statStripValue, s.tone && { color: s.tone }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LeaderboardCard({ b, lead, styles, c, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.leaderCard,
        lead && styles.leaderCardLead,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${b.name}`}
    >
      <View style={styles.leaderTop}>
        <View
          style={[
            styles.leaderAvatar,
            lead && { backgroundColor: c.textOnPrimary },
          ]}
        >
          <Text
            style={[
              styles.leaderAvatarText,
              lead && { color: c.primary },
            ]}
          >
            {(b.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        {lead ? (
          <Ionicons name="trophy" size={14} color={c.textOnPrimary} />
        ) : null}
      </View>
      <Text
        style={[styles.leaderName, lead && { color: c.textOnPrimary }]}
        numberOfLines={1}
      >
        {b.name}
      </Text>
      <Text
        style={[styles.leaderValue, lead && { color: c.textOnPrimary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {b.revenueLabel}
      </Text>
    </Pressable>
  );
}

const BranchRow = memo(function BranchRow({
  b,
  rank,
  maxRev,
  perms,
  styles,
  c,
  animate,
  index,
  onPress,
}) {
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index, 6) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index, animate]);

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
                  outputRange: [10, 0],
                }),
              },
            ]
          : [],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${b.name}`}
      >
        <View style={styles.rowRank}>
          <Text style={styles.rowRankText}>{rank + 1}</Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {b.name}
            </Text>
            {hasLow ? (
              <View style={styles.rowWarnChip}>
                <Ionicons name="alert-circle" size={10} color={c.warning} />
                <Text style={styles.rowWarnText}>{b.lowStockItems}</Text>
              </View>
            ) : null}
          </View>

          {perms.revenue ? (
            <View style={styles.rowBarTrack}>
              <View
                style={[
                  styles.rowBarFill,
                  {
                    width: `${Math.max(
                      maxRev > 0
                        ? ((Number(b.revenue) || 0) / maxRev) * 100
                        : 0,
                      3
                    )}%`,
                  },
                ]}
              />
            </View>
          ) : null}

          <View style={styles.rowMetaLine}>
            {perms.members ? (
              <Text style={styles.rowMeta}>{b.activeUsers} staff</Text>
            ) : null}
            {perms.revenue ? (
              <Text style={styles.rowMeta}>
                {b.transactions} {b.transactions === 1 ? 'sale' : 'sales'}
              </Text>
            ) : null}
          </View>
        </View>

        {perms.revenue ? (
          <Text
            style={styles.rowRevenue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {b.revenueLabel}
          </Text>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        )}
      </Pressable>
    </Animated.View>
  );
});

function SingleHero({ b, perms, styles, c, animate, onPress }) {
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
        style={({ pressed }) => [
          styles.hero,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${b.name}`}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>
              {(b.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroName} numberOfLines={1}>
              {b.name}
            </Text>
            <Text style={styles.heroSub}>Your branch · Today</Text>
          </View>
        </View>

        {perms.revenue ? (
          <View style={styles.heroRevenue}>
            <Text style={styles.heroKicker}>SALES TODAY</Text>
            <Text
              style={styles.heroValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {b.revenueLabel}
            </Text>
          </View>
        ) : null}

        <View style={styles.heroFooter}>
          {perms.revenue ? (
            <Text style={styles.heroMeta}>
              {b.transactions} {b.transactions === 1 ? 'sale' : 'sales'}
            </Text>
          ) : (
            <View />
          )}
          <View style={styles.heroOpen}>
            <Text style={styles.heroOpenText}>Open</Text>
            <Ionicons name="arrow-forward" size={14} color={c.textOnPrimary} />
          </View>
        </View>
      </Pressable>

      <View style={styles.heroTiles}>
        {perms.revenue ? (
          <View style={styles.heroTile}>
            <Ionicons name="pricetag-outline" size={16} color={c.link} />
            <Text style={styles.heroTileValue} numberOfLines={1}>
              {b.avgSaleLabel || '—'}
            </Text>
            <Text style={styles.heroTileLabel}>Avg sale</Text>
          </View>
        ) : null}
        {perms.members ? (
          <View style={styles.heroTile}>
            <Ionicons name="people-outline" size={16} color={c.link} />
            <Text style={styles.heroTileValue}>{b.activeUsers ?? 0}</Text>
            <Text style={styles.heroTileLabel}>Staff</Text>
          </View>
        ) : null}
        {perms.inventory ? (
          <View style={styles.heroTile}>
            <Ionicons
              name={
                b.lowStockItems > 0
                  ? 'alert-circle-outline'
                  : 'checkmark-circle-outline'
              }
              size={16}
              color={b.lowStockItems > 0 ? c.warning : c.success}
            />
            <Text
              style={[
                styles.heroTileValue,
                b.lowStockItems > 0 && { color: c.warning },
              ]}
            >
              {b.lowStockItems > 0 ? b.lowStockItems : 'OK'}
            </Text>
            <Text style={styles.heroTileLabel}>
              {b.lowStockItems > 0 ? 'Low stock' : 'Stock'}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function BranchesScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { formatCurrency } = useSettings();
  const { isOwner } = usePermissionsContext();

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

  const branches = useMemo(() => {
    const list = data?.branches || [];
    const sorted = perms.revenue
      ? [...list].sort(
          (a, b) => (Number(b.revenue) || 0) - (Number(a.revenue) || 0)
        )
      : list;
    return sorted.map((b) => {
      const tx = Number(b.transactions) || 0;
      const rev = Number(b.revenue) || 0;
      return {
        ...b,
        revenueLabel: formatCurrency(rev),
        avgSaleLabel: tx > 0 ? formatCurrency(rev / tx) : null,
      };
    });
  }, [data, perms.revenue, formatCurrency]);

  const totalRevenue = useMemo(
    () => branches.reduce((s, b) => s + (Number(b.revenue) || 0), 0),
    [branches]
  );
  const totalSales = useMemo(
    () => branches.reduce((s, b) => s + (Number(b.transactions) || 0), 0),
    [branches]
  );
  const maxRev = Number(branches[0]?.revenue) || 0;
  const single = branches.length === 1;
  const showStats = !single && branches.length > 0 && perms.revenue;
  const showLeaderboard = !single && branches.length > 1 && perms.revenue;

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

  const stats = showStats
    ? [
        {
          key: 'total',
          label: 'TODAY',
          value: formatCurrency(totalRevenue),
        },
        {
          key: 'sales',
          label: 'SALES',
          value: String(totalSales),
        },
        {
          key: 'avg',
          label: 'AVG / BRANCH',
          value: formatCurrency(totalRevenue / branches.length),
        },
      ]
    : [];

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
        <TopBar
          c={c}
          styles={styles}
          insets={insets}
          title={single ? 'Your branch' : 'Branches'}
          subtitle={`${activeOrganization?.name || 'Business'} · Today ${todayLabel()}`}
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

        {stats.length > 0 ? (
          <StatStrip styles={styles} stats={stats} />
        ) : null}

        {showLeaderboard ? (
          <>
            <Text style={styles.sectionLabel}>LEADERBOARD</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.leaderContent}
            >
              {branches.slice(0, 6).map((b, i) => (
                <LeaderboardCard
                  key={b.id}
                  b={b}
                  lead={i === 0}
                  styles={styles}
                  c={c}
                  onPress={() => open(b)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

{single ? (
  <View style={styles.section}>
    <SingleHero
      b={branches[0]}
      perms={perms}
      styles={styles}
      c={c}
      animate={shouldAnimate}
      onPress={() => open(branches[0])}
    />
  </View>
) : null}

        {!single && branches.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ALL BRANCHES</Text>
            {branches.map((b, i) => (
              <BranchRow
                key={b.id}
                b={b}
                rank={i}
                maxRev={maxRev}
                perms={perms}
                styles={styles}
                c={c}
                animate={shouldAnimate}
                index={i}
                onPress={() => open(b)}
              />
            ))}
          </View>
        ) : null}

        {!error && branches.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="storefront-outline"
                size={26}
                color={c.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>No branches yet</Text>
            <Text style={styles.emptySub}>
              Branches you can access will show up here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxxl },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    topTitle: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    topSub: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    statStrip: {
      flexDirection: 'row',
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    statStripItem: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 4,
      position: 'relative',
    },
    statDivider: {
      position: 'absolute',
      left: 0,
      top: 4,
      bottom: 4,
      width: 1,
      backgroundColor: c.border,
    },
    statStripLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    statStripValue: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },

    section: { marginTop: spacing.xl },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },

    leaderContent: {
      paddingHorizontal: spacing.xl,
      gap: 10,
    },
    leaderCard: {
      width: 140,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    leaderCardLead: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    leaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leaderAvatar: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leaderAvatarText: {
      color: c.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    leaderName: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    leaderValue: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderColor: c.border,
    },
    cardPressed: { opacity: 0.75 },
    rowRank: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowRankText: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    rowNameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowName: {
      flexShrink: 1,
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    rowWarnChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    rowWarnText: {
      color: c.warning,
      fontSize: 11,
      fontWeight: '800',
    },
    rowBarTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: c.border,
      marginTop: 8,
      overflow: 'hidden',
    },
    rowBarFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    rowMetaLine: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
    },
    rowMeta: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    rowRevenue: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
      maxWidth: 100,
      textAlign: 'right',
    },

    hero: {
      marginHorizontal: spacing.xl,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: spacing.lg,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroAvatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroAvatarText: {
      color: c.textOnPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    heroName: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    heroSub: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    heroRevenue: { marginTop: 20 },
    heroKicker: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    heroValue: {
      color: c.textPrimary,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '900',
      letterSpacing: -1.2,
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    heroMeta: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    heroOpen: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    heroOpenText: {
      color: c.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    heroTiles: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: spacing.xl,
      marginTop: 10,
    },
    heroTile: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
    },
    heroTileValue: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: -0.4,
      marginTop: 8,
      fontVariant: ['tabular-nums'],
    },
    heroTileLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
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

    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 6,
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 8,
    },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },

    tip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginHorizontal: spacing.xl,
      marginTop: 12,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
    },
    tipIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipTitle: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 2,
    },
    tipText: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
    },

    memberNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginHorizontal: spacing.xl,
      marginTop: 12,
      padding: spacing.md,
      borderRadius: 14,
      backgroundColor: c.surfaceElevated,
    },
    memberNoteText: {
      flex: 1,
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },

    skRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderColor: c.border,
    },
  });