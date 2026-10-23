// src/screens/branches/BranchShiftsScreen.jsx
//
// v3 — currency via settings context.
//   - Reads formatCurrency from useSettings().
//   - All four money spots use formatCurrency (Alert, current shift float,
//     shift float, shift variance).
//   - Everything else preserved: cache, skeleton, force-close modal, action
//     states, race-token guard, filter pills, header, stale chip.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import branchesService from '../../services/branches.service';
import { readRow, writeRow } from '../../cache/db';

/* ── cache helpers ──────────────────────────────────────────── */

function shiftsKey(orgId, branchId) {
  return `shifts:${orgId}:${branchId}`;
}

async function readBranchShiftsCache(orgId, branchId) {
  if (!orgId || !branchId) return null;
  const row = await readRow('settings_cache', {
    org_id: shiftsKey(orgId, branchId),
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeBranchShiftsCache(orgId, branchId, payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('settings_cache', {
    org_id: shiftsKey(orgId, branchId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── utils ─────────────────────────────────────────────────── */

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
  if (d.toDateString() === today.toDateString())
    return `Today · ${fmtTime(iso)}`;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString())
    return `Yesterday · ${fmtTime(iso)}`;
  return d.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_META = {
  OPEN: { label: 'Open', icon: 'time-outline', color: 'success' },
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
  { id: 'all', label: 'All', icon: 'list-outline' },
  {
    id: 'CLOSED_PENDING_REVIEW',
    label: 'Review',
    icon: 'alert-circle-outline',
  },
  { id: 'OPEN', label: 'Open', icon: 'time-outline' },
  { id: 'CLOSED', label: 'Closed', icon: 'checkmark-circle-outline' },
];

/* ── Skeleton primitive ─────────────────────────────────────── */

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
        <Sk width={110} height={24} r={12} />
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sk width="55%" height={22} r={8} />
          <Sk width="40%" height={13} r={6} style={{ marginTop: 3 }} />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
      </View>

      <View style={styles.headerRule} />

      <View style={styles.filterRow}>
        <Sk width="23%" height={40} r={12} />
        <Sk width="23%" height={40} r={12} />
        <Sk width="23%" height={40} r={12} />
        <Sk width="23%" height={40} r={12} />
      </View>
    </View>
  );
}

function BodySkeleton({ styles }) {
  return (
    <View style={styles.section}>
      <Sk
        width={120}
        height={11}
        r={5}
        style={{ marginBottom: spacing.sm }}
      />

      <View style={styles.currentCard}>
        <View style={styles.currentTop}>
          <Sk width={8} height={8} r={4} />
          <Sk width={90} height={11} r={5} />
        </View>
        <Sk width="40%" height={18} r={6} style={{ marginTop: 4 }} />
        <Sk width="70%" height={11} r={5} style={{ marginTop: 6 }} />
        <Sk
          width="100%"
          height={44}
          r={radius.md}
          style={{ marginTop: 12 }}
        />
      </View>

      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.shiftCard}>
            <View style={styles.shiftTop}>
              <Sk width={100} height={20} r={10} />
              <Sk width={80} height={11} r={5} />
            </View>
            <Sk width="50%" height={15} r={6} style={{ marginTop: 8 }} />
            <View style={[styles.shiftMetaRow, { marginTop: 8 }]}>
              <Sk width={90} height={10} r={5} />
              <Sk width={70} height={10} r={5} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BranchShiftsSkeleton({ styles, insets }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <HeaderSkeleton styles={styles} insets={insets} />
        <View style={styles.body}>
          <BodySkeleton styles={styles} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Floating header ────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  branchName,
  summary,
  filter,
  setFilter,
  shifts,
  onBack,
}) {
  const monogram = (branchName || 'B').trim().charAt(0).toUpperCase();
  const open = Number(summary?.open || 0);
  const pending = Number(summary?.pendingReview || 0);
  const closed = Number(summary?.closedToday || 0);

  const statusCfg =
    pending > 0
      ? {
          bg: c.dangerSoft,
          fg: c.danger,
          icon: 'alert-circle',
          label: 'Attention',
        }
      : open > 0
        ? { bg: c.primarySoft, fg: c.primary, icon: 'time', label: 'Open' }
        : {
            bg: c.surfaceElevated,
            fg: c.textMuted,
            icon: 'checkmark-circle',
            label: 'All clear',
          };

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
            <Ionicons
              name="arrow-back"
              size={18}
              color={c.textPrimary}
            />
          </TouchableOpacity>
          <View style={styles.monogramSmall}>
            <Text style={styles.monogramSmallText}>{monogram}</Text>
          </View>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusCfg.bg }]}>
          <Ionicons
            name={statusCfg.icon}
            size={11}
            color={statusCfg.fg}
          />
          <Text style={[styles.statusText, { color: statusCfg.fg }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {branchName || 'Branch'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Shifts
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="time-outline" size={13} color={c.success} />
          <Text style={[styles.statChipValue, { color: c.success }]}>
            {open}
          </Text>
          <Text style={styles.statChipLabel}>open</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="alert-circle-outline"
            size={13}
            color={c.warning}
          />
          <Text style={[styles.statChipValue, { color: c.warning }]}>
            {pending}
          </Text>
          <Text style={styles.statChipLabel}>review</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="checkmark-circle-outline"
            size={13}
            color={c.link}
          />
          <Text style={styles.statChipValue}>{closed}</Text>
          <Text style={styles.statChipLabel}>today</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count =
            f.id === 'all'
              ? shifts.length
              : shifts.filter((s) => s.status === f.id).length;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
                numberOfLines={1}
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────────── */

export default function BranchShiftsScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { formatCurrency } = useSettings();
  const { branchId, branchName } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [acting, setActing] = useState(null);
  const [forceCloseTarget, setForceCloseTarget] = useState(null);
  const [declaredCash, setDeclaredCash] = useState('');

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
        const cached = await readBranchShiftsCache(orgId, branchId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const res = await branchesService.getBranchShifts(orgId, branchId);
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(res);
        setStaleError(null);
        writeBranchShiftsCache(orgId, branchId, res);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load shifts';
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

  const shifts = data?.shifts || [];
  const filtered =
    filter === 'all' ? shifts : shifts.filter((s) => s.status === filter);
  const canReview = data?.canReview === true;
  const canForceClose = data?.canForceClose === true;
  const summary = data?.summary || {
    open: 0,
    pendingReview: 0,
    closedToday: 0,
  };
  const label = data?.branch?.name || branchName || 'Branch';

  const handleReview = useCallback(
    (shift) => {
      Alert.alert(
        'Review variance',
        `Mark this shift as reviewed? Variance: ${formatCurrency(
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
    },
    [activeOrganization?.id, branchId, formatCurrency, load]
  );

  const submitForceClose = useCallback(async () => {
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
  }, [
    activeOrganization?.id,
    branchId,
    declaredCash,
    forceCloseTarget,
    load,
  ]);

  if (loading && !data && !error) {
    return <BranchShiftsSkeleton styles={styles} insets={insets} />;
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
          branchName={label}
          summary={summary}
          filter={filter}
          setFilter={setFilter}
          shifts={shifts}
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

        <View style={styles.body}>
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
                  ? ` · Float ${formatCurrency(data.current.openingFloat)}`
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

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="time-outline"
                size={40}
                color={c.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {filter === 'all'
                  ? 'No shifts yet'
                  : 'Nothing in this filter'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'Shifts will appear here once cashiers start using the POS.'
                  : 'Try another filter.'}
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECENT</Text>
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
                          <Ionicons
                            name={meta.icon}
                            size={14}
                            color={color}
                          />
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
                            Float {formatCurrency(s.openingFloat)}
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
                            Variance {formatCurrency(s.variance)}
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
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color={c.textOnPrimary}
                          />
                          <Text style={styles.actionText}>
                            {isActing ? 'Marking…' : 'Mark reviewed'}
                          </Text>
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
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!forceCloseTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setForceCloseTarget(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setForceCloseTarget(null)}
          >
            <View
              style={styles.modalCard}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>Force close shift</Text>
              <Text style={styles.modalBody}>
                Enter the declared cash for this shift. This will close
                it as a manager force-close and log the action.
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
                  disabled={acting != null}
                >
                  <Text style={styles.modalConfirmText}>
                    {acting != null ? 'Closing…' : 'Close shift'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles (unchanged) ──────────────────────────────────────── */

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

    filterRow: { flexDirection: 'row', gap: 8 },
    filterPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: 12,
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
      fontSize: 11,
    },
    filterTextActive: { color: c.textOnPrimary },
    filterCount: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '800',
      fontSize: 10,
    },
    filterCountActive: { color: c.textOnPrimary },

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

    currentCard: {
      backgroundColor: c.surface,
      borderColor: c.primary,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
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
    currentName: { ...typography.h3, color: c.textPrimary },
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

    section: { marginTop: spacing.md },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },
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
    shiftMeta: { ...typography.caption, color: c.textMuted },
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