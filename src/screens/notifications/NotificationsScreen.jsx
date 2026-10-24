// src/screens/notifications/NotificationsScreen.jsx
//
// Alerts tab. Lists in-app notifications for the current org + product.
// Filter: All / Unread. Tap row → mark read + open a bottom sheet with
// the message and any actionable link. Mark all read button in header.
//
// v2 — floating header + 1:1 skeleton:
//   - Header card: back + monogram + status chip (Attention / Clear),
//     identity, three stat chips (unread / total / newest), filter pills
//     inside the header.
//   - Skeleton matches header + 3 notification rows 1:1.
//   - Stale chip on refresh failure; race-token guard.
//   - Detail bottom sheet unchanged.
//   - Alerts have no currency. Service calls unchanged.

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
  Modal,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import notificationsService from '../../services/notifications.service';

/* ── type meta ────────────────────────────────────────────────── */

const TYPE_META = {
  low_stock: { icon: 'cube-outline', color: 'warning', label: 'Stock' },
  out_of_stock: {
    icon: 'alert-circle-outline',
    color: 'danger',
    label: 'Stock',
  },
  shift_variance: {
    icon: 'cash-outline',
    color: 'danger',
    label: 'Shift',
  },
  shift_closed: {
    icon: 'time-outline',
    color: 'textMuted',
    label: 'Shift',
  },
  sync_failed: {
    icon: 'cloud-offline-outline',
    color: 'warning',
    label: 'Sync',
  },
  SUBSCRIPTION_EXPIRING_SOON: {
    icon: 'card-outline',
    color: 'warning',
    label: 'Billing',
  },
  PAYMENT_NOTICE_RECEIVED: {
    icon: 'checkmark-circle-outline',
    color: 'success',
    label: 'Billing',
  },
};

function typeMeta(type) {
  return (
    TYPE_META[type] || {
      icon: 'notifications-outline',
      color: 'textMuted',
      label: 'Alert',
    }
  );
}

function relTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
  });
}

const FILTERS = [
  { id: 'all', label: 'All', icon: 'list-outline' },
  { id: 'unread', label: 'Unread', icon: 'mail-unread-outline' },
];

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
        <Sk width={90} height={24} r={12} />
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sk width="60%" height={22} r={8} />
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
        <Sk width="48%" height={40} r={12} />
        <Sk width="48%" height={40} r={12} />
      </View>
    </View>
  );
}

function BodySkeleton({ styles }) {
  return (
    <View style={styles.section}>
      <Sk
        width={100}
        height={11}
        r={5}
        style={{ marginBottom: spacing.sm }}
      />

      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skRow}>
            <Sk width={36} height={36} r={10} />
            <View style={{ flex: 1, gap: 8 }}>
              <Sk width="35%" height={10} r={5} />
              <Sk width="80%" height={14} r={6} />
              <Sk width="60%" height={10} r={5} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function NotificationsSkeleton({ styles, insets }) {
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

/* ── Floating header ─────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  unreadCount,
  total,
  newestLabel,
  filter,
  setFilter,
  markingAll,
  onMarkAllRead,
}) {
  const statusCfg =
    unreadCount > 0
      ? {
          bg: c.dangerSoft,
          fg: c.danger,
          icon: 'alert-circle',
          label: 'Attention',
        }
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
          <View style={styles.monogramSmall}>
            <Ionicons
              name="notifications"
              size={16}
              color={c.textOnPrimary}
            />
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
            Alerts
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {total === 0
              ? 'Nothing yet'
              : unreadCount > 0
                ? `${unreadCount} unread of ${total}`
                : `${total} total · all read`}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons
            name="mail-unread-outline"
            size={13}
            color={unreadCount > 0 ? c.danger : c.textMuted}
          />
          <Text
            style={[
              styles.statChipValue,
              unreadCount > 0 && { color: c.danger },
            ]}
          >
            {unreadCount}
          </Text>
          <Text style={styles.statChipLabel}>unread</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="mail-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{total}</Text>
          <Text style={styles.statChipLabel}>total</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="time-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {newestLabel || '—'}
          </Text>
          <Text style={styles.statChipLabel}>newest</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = f.id === 'unread' ? unreadCount : total;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? c.textOnPrimary : c.textSecondary}
              />
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
            </Pressable>
          );
        })}
      </View>

      {unreadCount > 0 ? (
        <TouchableOpacity
          style={[styles.markAllBtn, markingAll && { opacity: 0.6 }]}
          onPress={onMarkAllRead}
          disabled={markingAll}
          activeOpacity={0.85}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={14}
            color={c.primary}
          />
          <Text style={styles.markAllText}>
            {markingAll ? 'Marking…' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ── Screen ──────────────────────────────────────────────────── */

export default function NotificationsScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sheetItem, setSheetItem] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

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
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else if (dataRef.current == null) setLoading(true);
      setError(null);

      try {
        const res = await notificationsService.list(orgId, {
          filter: filter === 'all' ? undefined : filter,
          limit: 50,
        });
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setData(res);
        setStaleError(null);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load alerts';
        if (dataRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOrganization?.id, filter]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const items = data?.items || [];
  const unreadItems = items.filter((i) => !i.read);
  const unreadCount = unreadItems.length;
  const total = data?.total ?? items.length;
  const newestLabel = items[0]?.createdAt
    ? relTime(items[0].createdAt)
    : null;

  const openItem = async (item) => {
    setSheetItem(item);
    if (!item.read) {
      try {
        await notificationsService.markRead(activeOrganization.id, item.id);
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) =>
                  i.id === item.id
                    ? { ...i, read: true, readAt: new Date().toISOString() }
                    : i
                ),
              }
            : prev
        );
      } catch {
        /* non-fatal */
      }
    }
  };

  const closeSheet = () => setSheetItem(null);

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationsService.markAllRead(activeOrganization.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.read
                  ? i
                  : { ...i, read: true, readAt: new Date().toISOString() }
              ),
            }
          : prev
      );
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not mark all read');
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading && !data && !error) {
    return <NotificationsSkeleton styles={styles} insets={insets} />;
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
          unreadCount={unreadCount}
          total={total}
          newestLabel={newestLabel}
          filter={filter}
          setFilter={setFilter}
          markingAll={markingAll}
          onMarkAllRead={markAllRead}
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
              name="alert-circle-outline"
              size={16}
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
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={36}
                  color={c.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'No unread alerts' : 'All clear'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'unread'
                  ? 'You have caught up on everything.'
                  : 'Alerts about stock, shifts and billing will appear here.'}
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {filter === 'unread' ? 'UNREAD' : 'RECENT'}
              </Text>
              <View style={styles.list}>
                {items.map((item) => {
                  const meta = typeMeta(item.type);
                  const color = c[meta.color] || c.textMuted;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.row,
                        !item.read && styles.rowUnread,
                      ]}
                      onPress={() => openItem(item)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.icon,
                          { backgroundColor: `${color}22` },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={color}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.rowType}>{meta.label}</Text>
                          <Text style={styles.rowTime}>
                            {relTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.rowTitle,
                            !item.read && styles.rowTitleUnread,
                          ]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.rowMessage} numberOfLines={2}>
                          {item.message}
                        </Text>
                      </View>
                      {!item.read ? (
                        <View style={styles.unreadDot} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!sheetItem}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
          <Pressable
            style={styles.sheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            {sheetItem ? (
              <>
                {(() => {
                  const meta = typeMeta(sheetItem.type);
                  const color = c[meta.color] || c.textMuted;
                  return (
                    <View style={styles.sheetHeaderRow}>
                      <View
                        style={[
                          styles.icon,
                          { backgroundColor: `${color}22` },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={20}
                          color={color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetType}>{meta.label}</Text>
                        <Text style={styles.sheetTime}>
                          {new Date(sheetItem.createdAt).toLocaleString(
                            'en-KE',
                            {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </Text>
                      </View>
                    </View>
                  );
                })()}
                <Text style={styles.sheetTitle}>{sheetItem.title}</Text>
                <Text style={styles.sheetBody}>{sheetItem.message}</Text>
                {sheetItem.organization ? (
                  <View style={styles.sheetMetaRow}>
                    <Ionicons
                      name="business-outline"
                      size={13}
                      color={c.textMuted}
                    />
                    <Text style={styles.sheetMetaText}>
                      {sheetItem.organization.name}
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.sheetClose}
                  onPress={closeSheet}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sheetCloseText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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

    chipRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    statChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 6,
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
      fontSize: 10,
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
      gap: 6,
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
    },
    filterTextActive: { color: c.textOnPrimary },
    filterCount: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '800',
      fontSize: 11,
    },
    filterCountActive: { color: c.textOnPrimary },

    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    markAllText: {
      ...typography.caption,
      color: c.primary,
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

    section: { marginTop: spacing.md },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },

    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    rowUnread: {
      backgroundColor: c.surfaceElevated,
      borderColor: c.primary + '33',
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    rowType: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontSize: 10,
    },
    rowTime: {
      ...typography.caption,
      color: c.textMuted,
      fontSize: 11,
    },
    rowTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    rowTitleUnread: { fontWeight: '800' },
    rowMessage: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginTop: 6,
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
    },
    emptyIcon: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.h3,
      color: c.textPrimary,
    },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 22,
    },

    skRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },

    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    sheetHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    sheetType: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      fontSize: 10,
    },
    sheetTime: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    sheetTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    sheetBody: {
      ...typography.body,
      color: c.textSecondary,
      lineHeight: 22,
    },
    sheetMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.lg,
    },
    sheetMetaText: {
      ...typography.caption,
      color: c.textMuted,
    },
    sheetClose: {
      marginTop: spacing.xl,
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    sheetCloseText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });