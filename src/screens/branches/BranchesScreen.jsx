// src/screens/branches/BranchesScreen.jsx
//
// Branches tab. Lists the branches the caller can see, with whatever
// fields the backend returned as non-null. Tapping a card pushes
// BranchHome — the branch workspace landing page.
//
// Scope switching is not this tab's job; that lives on the Home tab's
// scope pill. This tab is a directory of places to go.

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
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { ROUTES } from '../../constants/routes';
import { api } from '../../services/api';

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function BranchesScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const { activeOrganization } = useOrganizationContext();

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
      if (!activeOrganization?.id) {
        setData(null);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/api/v1/organizations/${activeOrganization.id}/kxtill/mobile/branches`,
          { params: { period: 'today' } }
        );
        if (mountedRef.current) setData(res.data?.data || null);
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              'Could not load branches'
          );
        }
      } finally {
        if (mountedRef.current) {
          if (isRefresh) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [activeOrganization?.id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = () => load(true);

  const branches = data?.branches || [];
  const currency = activeOrganization?.currency || 'KES';
  const canSeeRevenue = data?.scope?.canSeeRevenue !== false;
  const canSeeInventory = data?.scope?.canSeeInventory !== false;
  const canSeeMembers = data?.scope?.canSeeMembers !== false;
  const isOrgWide = data?.scope?.isOrgWide === true;

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
          <Text style={styles.kicker}>BRANCHES</Text>
          <Text style={styles.title}>
            {isOrgWide ? 'Your branches' : 'Your branch'}
          </Text>
          <Text style={styles.subtitle}>
            {isOrgWide
              ? `${branches.length} ${
                  branches.length === 1 ? 'branch' : 'branches'
                } · tap to open`
              : 'Tap to open your branch workspace.'}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {branches.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate(ROUTES.BRANCH_HOME, {
                branchId: b.id,
                branchName: b.name,
              })
            }
          >
            <View style={styles.cardTop}>
              <View style={styles.iconChip}>
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={c.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.branchName} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={styles.branchMeta} numberOfLines={1}>
                  {canSeeRevenue
                    ? `${currency} ${fmt(b.revenue)} · ${b.transactions} ${
                        b.transactions === 1 ? 'tx' : 'tx'
                      } today`
                    : canSeeInventory
                      ? `${b.lowStockItems} low stock`
                      : 'Tap to open'}
                </Text>
              </View>
              <View style={styles.chevron}>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={c.textPrimary}
                />
              </View>
            </View>

            <View style={styles.metaRow}>
              {canSeeMembers ? (
                <View style={styles.metaItem}>
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={c.textMuted}
                  />
                  <Text style={styles.metaText}>
                    {b.activeUsers} active
                  </Text>
                </View>
              ) : null}

              {canSeeInventory ? (
                <View style={styles.metaItem}>
                  <Ionicons
                    name="cube-outline"
                    size={14}
                    color={b.lowStockItems > 0 ? c.warning : c.textMuted}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      b.lowStockItems > 0 && { color: c.warning },
                    ]}
                  >
                    {b.lowStockItems} low
                  </Text>
                </View>
              ) : null}

              {canSeeRevenue ? (
                <View style={styles.metaItem}>
                  <Ionicons
                    name="cash-outline"
                    size={14}
                    color={c.textMuted}
                  />
                  <Text style={styles.metaText}>
                    {currency} {fmt(b.revenue)}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}

        {!isOrgWide && branches.length === 1 ? (
          <Text style={styles.hint}>
            Ask the owner to assign you to more branches if you need access
            to others.
          </Text>
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
      paddingTop: spacing.md,
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
    header: { marginBottom: spacing.lg },
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
      lineHeight: 22,
    },
    error: {
      ...typography.caption,
      color: c.danger,
      marginTop: spacing.sm,
    },

    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    branchName: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 16,
    },
    branchMeta: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    chevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '600',
    },

    hint: {
      ...typography.caption,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      lineHeight: 18,
    },
  });