// src/screens/branches/SalesListScreen.jsx
//
// List of completed sales for the active branch. Tap a row → ReceiptScreen.
// Uses the existing GET /sales endpoint with status=COMPLETED.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { useSettings } from '../../context/SettingsContext';
import { ROUTES } from '../../constants/routes';
import { api } from '../../services/api';

export default function SalesListScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization, activeBranch } = useOrganizationContext();
  const { getCurrency } = useSettings();

  const [sales, setSales] = useState([]);
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
      if (!activeOrganization?.id) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = { status: 'COMPLETED', limit: 50 };
        if (activeBranch?.id) params.branchId = activeBranch.id;

        const { data } = await api.get(
          `/api/v1/organizations/${activeOrganization.id}/kxtill/sales`,
          { params }
        );

        const list = Array.isArray(data?.sales)
          ? data.sales
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        if (mountedRef.current) setSales(list);
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
    [activeOrganization?.id, activeBranch?.id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const currency = getCurrency();

  const amount = (n) => {
    const v = Number(n || 0).toFixed(2);
    const [intPart, decPart] = v.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return currency ? `${currency} ${withCommas}.${decPart}` : `${withCommas}.${decPart}`;
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.iconChip}
        >
          <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Receipts
        </Text>
        <View style={styles.iconChip} />
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>RECEIPTS</Text>
        <Text style={styles.title}>Recent sales</Text>
        <Text style={styles.subtitle}>
          {activeBranch?.name
            ? `${activeBranch.name} · tap to preview and share`
            : 'Tap a sale to preview and share'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {sales.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={40} color={c.textMuted} />
          <Text style={styles.emptyTitle}>No completed sales</Text>
          <Text style={styles.emptyText}>
            Once a sale is completed, it shows up here for sharing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={c.primary}
            />
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
                  {fmtDate(item.createdAt)}
                  {item.customerName ? ` · ${item.customerName}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>
                  {amount(item.totalAmount)}
                </Text>
                <Text style={styles.meta}>
                  {item.branchName || item.branch?.name || ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    titleBlock: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
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
    list: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
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