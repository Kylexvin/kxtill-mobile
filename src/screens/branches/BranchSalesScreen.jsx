// src/screens/branches/BranchSalesScreen.jsx
//
// Branch sales detail. Revenue summary, payment mix, top products,
// recent transactions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import branchesService from '../../services/branches.service';

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const relTime = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

export default function BranchSalesScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
      if (!activeOrganization?.id || !branchId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await branchesService.getBranchSales(
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
              'Could not load sales'
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

  const currency = activeOrganization?.currency || 'KES';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const summary = data?.summary;
  const payments = data?.payments;
  const products = data?.topProducts || [];
  const recent = data?.recent || [];

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Sales
          </Text>
          <View style={styles.iconChip} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>SALES</Text>
          <Text style={styles.title} numberOfLines={1}>
            {data?.branch?.name || branchName || 'Branch'}
          </Text>
          <Text style={styles.subtitle}>Today</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Summary card */}
        {summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL SALES</Text>
            <Text style={styles.summaryValue}>
              {currency} {fmt(summary.revenue)}
            </Text>
            <Text style={styles.summarySub}>
              {summary.transactions}{' '}
              {summary.transactions === 1 ? 'transaction' : 'transactions'}
            </Text>
          </View>
        ) : null}

        {/* Payment mix */}
        {payments?.methods?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAYMENT MIX</Text>
            <View style={styles.group}>
              <View style={styles.mixBar}>
                {payments.methods.map((p) => (
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
                {payments.methods.map((p) => (
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
        {products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TOP PRODUCTS</Text>
            <View style={styles.group}>
              {products.map((p, i) => (
                <View
                  key={p.id || p.name}
                  style={[styles.productRow, i > 0 && styles.rowDivider]}
                >
                  <Text style={styles.rank}>{i + 1}</Text>
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

        {/* Recent transactions */}
        {recent.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>
            <View style={styles.group}>
              {recent.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.txRow, i > 0 && styles.rowDivider]}
                >
                  <View style={styles.txIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color={c.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {s.itemsSummary || `${s.items} items`}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {s.cashier} · {relTime(s.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>
                    {currency} {fmt(s.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!summary && !recent.length && !products.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={32} color={c.textMuted} />
            <Text style={styles.emptyText}>No sales recorded yet today.</Text>
          </View>
        ) : null}
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
      justifyContent: 'space-between',
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
    headerTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
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

    summaryCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    summaryLabel: {
      ...typography.label,
      color: c.textMuted,
    },
    summaryValue: {
      color: c.textPrimary,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.2,
      marginTop: spacing.xs,
    },
    summarySub: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs,
    },

    section: { marginBottom: spacing.xl },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
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
  });