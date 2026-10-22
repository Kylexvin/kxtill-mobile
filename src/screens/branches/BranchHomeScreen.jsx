// src/screens/branches/BranchHomeScreen.jsx
//
// Branch workspace landing page. Overview stats, 7-day trend,
// payment mix, top products. Tiles to sub-areas.
//
// Tile gating:
//   - sales      → kxtill.sales.view (backend returns sales data at all)
//   - stock      → kxtill.inventory.view
//   - shifts     → branches.view
//   - settings   → always visible; read-only for non-owners (screen enforces)
//   - transfers, team, devices → hidden until built

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { ROUTES } from '../../constants/routes';
import branchesService from '../../services/branches.service';

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function BranchHomeScreen({ route }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const { activeOrganization } = useOrganizationContext();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!activeOrganization?.id || !branchId) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await branchesService.getBranchDetail(
          activeOrganization.id,
          branchId,
          'today'
        );
        if (mountedRef.current) setData(res);
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              'Could not load branch'
          );
        }
      } finally {
        if (mountedRef.current) {
          if (isRefresh) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [activeOrganization?.id, branchId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = () => load(true);

  const branch = data?.branch;
  const currency = activeOrganization?.currency || 'KES';
  const canSeeRevenue = data?.scope?.canSeeRevenue === true;
  const canSeeInventory = data?.scope?.canSeeInventory === true;
  const canSeeMembers = data?.scope?.canSeeMembers === true;

  const tiles = useMemo(() => {
    const list = [];

    if (canSeeRevenue) {
      list.push({
        id: 'sales',
        label: 'Sales',
        description: 'Recent transactions & top products',
        icon: 'receipt-outline',
        onPress: () =>
          navigation.navigate(ROUTES.BRANCH_SALES, {
            branchId,
            branchName: branch?.name || branchName,
          }),
      });
    }

    if (canSeeInventory) {
      list.push({
        id: 'stock',
        label: 'Stock',
        description: 'Low and out of stock',
        icon: 'cube-outline',
        onPress: () =>
          navigation.navigate(ROUTES.BRANCH_STOCK, {
            branchId,
            branchName: branch?.name || branchName,
          }),
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
    canSeeRevenue,
    canSeeInventory,
    branchId,
    branchName,
    branch?.name,
    navigation,
  ]);

  const trendValues = data?.trend?.values || [];
  const trendMax = Math.max(...trendValues, 1);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        <View pointerEvents="none" style={styles.glow} />

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.iconChip}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={styles.iconChip} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>BRANCH</Text>
          <Text style={styles.title} numberOfLines={1}>
            {branch?.name || branchName || 'Branch'}
          </Text>
          <Text style={styles.subtitle}>
            {activeOrganization?.name} · Today
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Overview */}
        {branch ? (
          <View style={styles.statsCard}>
            {canSeeRevenue ? (
              <>
                <Text style={styles.statsLabel}>TODAY'S REVENUE</Text>
                <Text style={styles.statsValue}>
                  {currency} {fmt(branch.revenue)}
                </Text>
                <View style={styles.statsPill}>
                  <Ionicons
                    name="receipt-outline"
                    size={12}
                    color={c.textMuted}
                  />
                  <Text style={styles.statsPillText}>
                    {branch.transactions}{' '}
                    {branch.transactions === 1
                      ? 'transaction'
                      : 'transactions'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.statsHidden}>
                Sales figures are not visible with your current access.
              </Text>
            )}

            <View style={styles.statsRow}>
              {canSeeMembers ? (
                <View style={styles.statsItem}>
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={c.primary}
                  />
                  <Text style={styles.statsItemValue}>
                    {branch.activeUsers}
                  </Text>
                  <Text style={styles.statsItemLabel}>Active</Text>
                </View>
              ) : null}
              {canSeeInventory ? (
                <View style={styles.statsItem}>
                  <Ionicons
                    name="cube-outline"
                    size={16}
                    color={
                      branch.lowStockItems > 0 ? c.warning : c.primary
                    }
                  />
                  <Text
                    style={[
                      styles.statsItemValue,
                      branch.lowStockItems > 0 && { color: c.warning },
                    ]}
                  >
                    {branch.lowStockItems}
                  </Text>
                  <Text style={styles.statsItemLabel}>Low stock</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* 7-day trend */}
        {canSeeRevenue && trendValues.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
            <View style={styles.trendCard}>
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

        {/* Payment mix */}
        {canSeeRevenue && data?.payments?.methods?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAYMENT MIX</Text>
            <View style={styles.group}>
              <View style={styles.mixBar}>
                {data.payments.methods.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      flex: p.pct,
                      backgroundColor:
                        p.id === 'mpesa'
                          ? c.success
                          : p.id === 'cash'
                            ? c.primary
                            : c.textMuted,
                    }}
                  />
                ))}
              </View>
              <View style={styles.mixLegend}>
                {data.payments.methods.map((p) => (
                  <View key={p.id} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor:
                            p.id === 'mpesa'
                              ? c.success
                              : p.id === 'cash'
                                ? c.primary
                                : c.textMuted,
                        },
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

        {/* Top products */}
        {canSeeRevenue && data?.products?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TOP PRODUCTS</Text>
            <View style={styles.group}>
              {data.products.map((p, i) => (
                <View
                  key={p.id || p.name}
                  style={[styles.productRow, i > 0 && styles.rowDivider]}
                >
                  <Text style={styles.productRank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.productMeta}>{p.units} sold</Text>
                  </View>
                  <Text style={styles.productRevenue}>
                    {currency} {fmt(p.revenue)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Explore tiles */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EXPLORE</Text>
          <View style={styles.tileGrid}>
            {tiles.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.tile}
                activeOpacity={0.8}
                onPress={t.onPress}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={t.icon} size={20} color={c.primary} />
                </View>
                <Text style={styles.tileLabel}>{t.label}</Text>
                <Text style={styles.tileDesc} numberOfLines={2}>
                  {t.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    glow: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: c.primary,
      opacity: 0.08,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },

    titleBlock: { marginBottom: spacing.lg },
    kicker: {
      ...typography.label,
      color: c.primary,
      letterSpacing: 1.6,
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.h1,
      color: c.textPrimary,
      letterSpacing: -0.6,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginTop: spacing.sm,
    },
    error: {
      ...typography.caption,
      color: c.danger,
      marginTop: spacing.sm,
    },

    statsCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    statsLabel: { ...typography.label, color: c.textMuted },
    statsValue: {
      color: c.textPrimary,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.2,
      marginTop: spacing.xs,
    },
    statsHidden: {
      ...typography.body,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    statsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.surfaceElevated,
      marginTop: spacing.sm,
    },
    statsPillText: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    statsItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statsItemValue: { ...typography.h3, color: c.textPrimary },
    statsItemLabel: { ...typography.caption, color: c.textMuted },

    section: { marginBottom: spacing.xl },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },

    trendCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
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

    group: {
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

    tileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
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
    tileLabel: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    tileDesc: {
      ...typography.caption,
      color: c.textMuted,
      lineHeight: 16,
    },
  });