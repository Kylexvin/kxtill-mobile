// src/screens/branches/BranchShiftsScreen.jsx
//
// Branch shifts. Read-only except owner actions:
//   - Review variance on CLOSED_PENDING_REVIEW shifts
//   - Force-close OPEN shifts (with a declared cash prompt)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
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

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today · ${fmtTime(iso)}`;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday · ${fmtTime(iso)}`;
  return d.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_META = {
  OPEN: {
    label: 'Open',
    icon: 'time-outline',
    color: 'success',
  },
  CLOSED: {
    label: 'Closed',
    icon: 'checkmark-circle-outline',
    color: 'textMuted',
  },
  CLOSED_PENDING_REVIEW: {
    label: 'Needs review',
    icon: 'alert-circle-outline',
    color: 'warning',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: 'close-circle-outline',
    color: 'textMuted',
  },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'CLOSED_PENDING_REVIEW', label: 'Needs review' },
  { id: 'OPEN', label: 'Open' },
  { id: 'CLOSED', label: 'Closed' },
];

export default function BranchShiftsScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [acting, setActing] = useState(null); // shiftId being acted on
  const [forceCloseTarget, setForceCloseTarget] = useState(null);
  const [declaredCash, setDeclaredCash] = useState('');
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
        const res = await branchesService.getBranchShifts(
          activeOrganization.id,
          branchId
        );
        if (mountedRef.current) setData(res);
      } catch (e) {
        if (mountedRef.current) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              'Could not load shifts'
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

  const shifts = data?.shifts || [];
  const filtered =
    filter === 'all' ? shifts : shifts.filter((s) => s.status === filter);
  const currency = activeOrganization?.currency || 'KES';
  const canReview = data?.canReview === true;
  const canForceClose = data?.canForceClose === true;

  const handleReview = (shift) => {
    Alert.alert(
      'Review variance',
      `Mark this shift as reviewed? Variance: ${currency} ${fmt(
        shift.variance ?? 0
      )}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark reviewed',
          style: 'default',
          onPress: async () => {
            setActing(shift.id);
            try {
              await branchesService.reviewShiftVariance(
                activeOrganization.id,
                branchId,
                shift.id,
                null
              );
              await load(true);
            } catch (e) {
              Alert.alert(
                'Could not review',
                e?.response?.data?.message ||
                  e?.message ||
                  'Something went wrong'
              );
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const submitForceClose = async () => {
    if (!forceCloseTarget) return;
    const cash = Number(declaredCash);
    if (!Number.isFinite(cash) || cash < 0) {
      Alert.alert('Invalid amount', 'Enter a valid declared cash amount.');
      return;
    }
    setActing(forceCloseTarget.id);
    try {
      await branchesService.forceCloseShift(
        activeOrganization.id,
        branchId,
        forceCloseTarget.id,
        cash,
        null
      );
      setForceCloseTarget(null);
      setDeclaredCash('');
      await load(true);
    } catch (e) {
      Alert.alert(
        'Could not force close',
        e?.response?.data?.message ||
          e?.message ||
          'Something went wrong'
      );
    } finally {
      setActing(null);
    }
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

  const summary = data?.summary || {
    open: 0,
    pendingReview: 0,
    closedToday: 0,
  };

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
            Shifts
          </Text>
          <View style={styles.iconChip} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>SHIFTS</Text>
          <Text style={styles.title} numberOfLines={1}>
            {data?.branch?.name || branchName || 'Branch'}
          </Text>
          <Text style={styles.subtitle}>
            {summary.open} open · {summary.pendingReview} need review ·{' '}
            {summary.closedToday} closed today
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Current open shift */}
        {data?.current ? (
          <View style={styles.currentCard}>
            <View style={styles.currentTop}>
              <View style={styles.currentDot} />
              <Text style={styles.currentLabel}>SHIFT OPEN</Text>
            </View>
            <Text style={styles.currentName}>
              {data.current.cashier || 'Staff'}
            </Text>
            <Text style={styles.currentMeta}>
              Opened {fmtDate(data.current.openedAt)}
              {data.current.openingFloat != null
                ? ` · Float ${currency} ${fmt(data.current.openingFloat)}`
                : ''}
            </Text>
            {canForceClose ? (
              <TouchableOpacity
                style={styles.forceCloseBtn}
                onPress={() => {
                  setDeclaredCash('');
                  setForceCloseTarget(data.current);
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={c.textPrimary}
                />
                <Text style={styles.forceCloseText}>Force close</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Filter pills */}
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count =
              f.id === 'all'
                ? shifts.length
                : shifts.filter((s) => s.status === f.id).length;
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

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={40} color={c.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No shifts yet' : 'Nothing in this filter'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Shifts will appear here once cashiers start using the POS.'
                : 'Try another filter.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((s) => {
              const meta = STATUS_META[s.status] || STATUS_META.CLOSED;
              const color = c[meta.color] || c.textMuted;
              const isActing = acting === s.id;
              return (
                <View key={s.id} style={styles.shiftCard}>
                  <View style={styles.shiftTop}>
                    <View
                      style={[
                        styles.statusChip,
                        { backgroundColor: `${color}22` },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={14} color={color} />
                      <Text style={[styles.statusText, { color }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={styles.shiftTime}>
                      {fmtDate(s.closedAt || s.openedAt)}
                    </Text>
                  </View>
                  <Text style={styles.shiftCashier}>{s.cashier}</Text>
                  <View style={styles.shiftMetaRow}>
                    {s.openingFloat != null ? (
                      <Text style={styles.shiftMeta}>
                        Float {currency} {fmt(s.openingFloat)}
                      </Text>
                    ) : null}
                    {s.salesCount != null ? (
                      <Text style={styles.shiftMeta}>
                        {s.salesCount} sales
                      </Text>
                    ) : null}
                    {s.variance != null ? (
                      <Text
                        style={[
                          styles.shiftMeta,
                          Math.abs(s.variance) > 0 && {
                            color:
                              s.status === 'CLOSED_PENDING_REVIEW'
                                ? c.warning
                                : c.textPrimary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        Variance {currency} {fmt(s.variance)}
                      </Text>
                    ) : null}
                  </View>

                  {s.status === 'CLOSED_PENDING_REVIEW' && canReview ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleReview(s)}
                      disabled={isActing}
                      activeOpacity={0.85}
                    >
                      {isActing ? (
                        <ActivityIndicator color={c.textOnPrimary} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color={c.textOnPrimary}
                          />
                          <Text style={styles.actionText}>
                            Mark reviewed
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {s.status === 'OPEN' && canForceClose ? (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => {
                        setDeclaredCash('');
                        setForceCloseTarget(s);
                      }}
                      disabled={isActing}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={16}
                        color={c.textPrimary}
                      />
                      <Text style={styles.actionTextSecondary}>
                        Force close
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Force close modal */}
      <Modal
        visible={!!forceCloseTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setForceCloseTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Force close shift</Text>
            <Text style={styles.modalBody}>
              Enter the declared cash for this shift. This will close it as a
              manager force-close and log the action.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={declaredCash}
              onChangeText={setDeclaredCash}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={c.textMuted}
              selectionColor={c.primary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setForceCloseTarget(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={submitForceClose}
              >
                <Text style={styles.modalConfirmText}>Close shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

    currentCard: {
      backgroundColor: c.surface,
      borderColor: c.primary,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    currentTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    currentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.success,
    },
    currentLabel: {
      ...typography.label,
      color: c.success,
      letterSpacing: 1.2,
    },
    currentName: {
      ...typography.h3,
      color: c.textPrimary,
    },
    currentMeta: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 4,
    },
    forceCloseBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    forceCloseText: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },

    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
    filterActive: { backgroundColor: c.primary, borderColor: c.primary },
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
    shiftCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    shiftTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    shiftTime: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '600',
    },
    shiftCashier: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 15,
    },
    shiftMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    shiftMeta: {
      ...typography.caption,
      color: c.textMuted,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    actionText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
      fontSize: 14,
    },
    actionBtnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionTextSecondary: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
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

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
    },
    modalTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    modalBody: {
      ...typography.body,
      color: c.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    modalInput: {
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: c.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    modalCancel: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalCancelText: {
      ...typography.bodyStrong,
      color: c.textSecondary,
    },
    modalConfirm: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
    },
    modalConfirmText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });