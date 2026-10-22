// src/screens/branches/BranchStockScreen.jsx
//
// Branch stock detail. Low-stock and out-of-stock items for this branch.

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

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'out', label: 'Out of stock' },
  { id: 'low', label: 'Low' },
];

export default function BranchStockScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
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
        const res = await branchesService.getBranchStock(
          activeOrganization.id,
          branchId
        );
        if (mountedRef.current) setData(res);
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              'Could not load stock'
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

  const items = data?.items || [];
  const filteredItems =
    filter === 'all' ? items : items.filter((i) => i.status === filter);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const summary = data?.summary || { outCount: 0, lowCount: 0, total: 0 };

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
            Stock
          </Text>
          <View style={styles.iconChip} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>STOCK</Text>
          <Text style={styles.title} numberOfLines={1}>
            {data?.branch?.name || branchName || 'Branch'}
          </Text>
          <Text style={styles.subtitle}>
            {summary.outCount} out of stock · {summary.lowCount} low
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Filter pills */}
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count =
              f.id === 'out'
                ? summary.outCount
                : f.id === 'low'
                  ? summary.lowCount
                  : summary.total;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filter, active && styles.filterActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.85}
              >
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
              </TouchableOpacity>
            );
          })}
        </View>

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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.sku ? (
                      <Text style={styles.itemSku} numberOfLines={1}>
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
        )}
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

    filters: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    filter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterActive: {
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