// src/screens/branches/TeamScreen.jsx
//
// v3 — View shifts link + navigation guard:
//   - Adds a "View shifts" action row below the member list, linking to
//     BranchShiftsScreen for the same branch (existing screen, existing
//     endpoint, no new backend).
//   - The link only renders when a branch is available, so no navigation
//     with null params.
//   - Everything else from v2 preserved (cache, skeleton, floating header,
//     stale chip, race-token guard).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
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
import { ROUTES } from '../../constants/routes';
import { api } from '../../services/api';
import { readRow, writeRow } from '../../cache/db';

/* ── cache ──────────────────────────────────────────────────── */

function teamKey(orgId, branchId) {
  return `team:${orgId}:${branchId}`;
}

async function readTeamCache(orgId, branchId) {
  if (!orgId || !branchId) return null;
  const row = await readRow('settings_cache', {
    org_id: teamKey(orgId, branchId),
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeTeamCache(orgId, branchId, payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('settings_cache', {
    org_id: teamKey(orgId, branchId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── skeleton ───────────────────────────────────────────────── */

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

      <View style={styles.actionRow}>
        <Sk width="100%" height={40} r={12} />
      </View>
    </View>
  );
}

function TeamSkeleton({ styles, insets }) {
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
            <Sk
              width={90}
              height={11}
              r={5}
              style={{ marginBottom: spacing.sm }}
            />
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.card}>
                  <Sk width={44} height={44} r={14} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Sk width="55%" height={14} r={6} />
                    <Sk width="70%" height={10} r={5} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── floating header ────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  branchName,
  membersCount,
  onShiftCount,
  ownersCount,
  onBack,
}) {
  const monogram = (branchName || 'B').trim().charAt(0).toUpperCase();
  const hasLive = onShiftCount > 0;

  const statusCfg = hasLive
    ? {
        bg: c.primarySoft,
        fg: c.primary,
        icon: 'time',
        label: 'On shift',
      }
    : {
        bg: c.surfaceElevated,
        fg: c.textMuted,
        icon: 'time-outline',
        label: 'No shifts',
      };

  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View pointerEvents="none" style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </Pressable>
          <View style={styles.monogramSmall}>
            <Text style={styles.monogramSmallText}>{monogram}</Text>
          </View>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusCfg.bg }]}>
          <Ionicons name={statusCfg.icon} size={11} color={statusCfg.fg} />
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
            Team
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="people-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{membersCount}</Text>
          <Text style={styles.statChipLabel}>people</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="time-outline"
            size={13}
            color={hasLive ? c.success : c.textMuted}
          />
          <Text
            style={[
              styles.statChipValue,
              hasLive && { color: c.success },
            ]}
          >
            {onShiftCount}
          </Text>
          <Text style={styles.statChipLabel}>on shift</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="shield-checkmark-outline"
            size={13}
            color={c.link}
          />
          <Text style={styles.statChipValue}>{ownersCount}</Text>
          <Text style={styles.statChipLabel}>owners</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        <View style={styles.actionInfo}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={c.link}
          />
          <Text style={styles.actionInfoText} numberOfLines={2}>
            Everyone assigned to this branch, plus owners with all-branch
            access.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── screen ─────────────────────────────────────────────────── */

export default function TeamScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, activeBranch } = useOrganizationContext();

  const branchId = activeBranch?.id ?? null;
  const branchName = activeBranch?.name ?? null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

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
        const cached = await readTeamCache(orgId, branchId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setData(cached.payload);
          setLoading(false);
        }
      }

      try {
        const { data: res } = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/mobile/branches/${branchId}/team`
        );
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const payload = res?.data || null;
        setData(payload);
        setStaleError(null);
        writeTeamCache(orgId, branchId, payload);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load team';
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

  const members = data?.members || [];
  const onShiftCount = data?.onShiftCount ?? 0;
  const ownersCount = members.filter((m) => m.isOwner).length;
  const label = data?.branch?.name || branchName || 'Branch';

  const goToShifts = useCallback(() => {
    if (!branchId) return;
    navigation.navigate(ROUTES.BRANCH_SHIFTS, {
      branchId,
      branchName: label,
    });
  }, [navigation, branchId, label]);

  if (loading && !data && !error) {
    return <TeamSkeleton styles={styles} insets={insets} />;
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
          membersCount={members.length}
          onShiftCount={onShiftCount}
          ownersCount={ownersCount}
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
          {members.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={40}
                color={c.textMuted}
              />
              <Text style={styles.emptyTitle}>No one here yet</Text>
              <Text style={styles.emptyText}>
                Staff will appear here once they are assigned to this
                branch.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PEOPLE</Text>
                <View style={styles.list}>
                  {members.map((m) => {
                    const initials = m.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join('');

                    return (
                      <View key={m.userId} style={styles.card}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {initials || '?'}
                          </Text>
                        </View>

                        <View style={styles.cardBody}>
                          <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>
                              {m.name}
                            </Text>
                            {m.isOwner ? (
                              <View style={styles.ownerPill}>
                                <Ionicons
                                  name="shield-checkmark"
                                  size={10}
                                  color={c.primary}
                                />
                                <Text style={styles.ownerPillText}>
                                  Owner
                                </Text>
                              </View>
                            ) : m.role ? (
                              <View style={styles.rolePill}>
                                <Text style={styles.rolePillText}>
                                  {m.role}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {m.email ? (
                            <Text style={styles.email} numberOfLines={1}>
                              {m.email}
                            </Text>
                          ) : null}
                          {m.kxtill?.onShift ? (
                            <View style={styles.shiftRow}>
                              <View style={styles.liveDot} />
                              <Text style={styles.shiftText}>
                                On shift
                                {m.kxtill.shiftStartedAt
                                  ? ` · since ${new Date(
                                      m.kxtill.shiftStartedAt
                                    ).toLocaleTimeString('en-KE', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : ''}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {branchId ? (
                <Pressable
                  onPress={goToShifts}
                  style={({ pressed }) => [
                    styles.shiftsLink,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="View shifts for this branch"
                >
                  <View style={styles.shiftsIcon}>
                    <Ionicons name="time-outline" size={18} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shiftsTitle}>View shifts</Text>
                    <Text style={styles.shiftsSub} numberOfLines={1}>
                      Current and recent shifts at this branch
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={c.textMuted}
                  />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────────── */

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

    actionRow: { flexDirection: 'row', gap: 10 },
    actionInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
    },
    actionInfoText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
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
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: c.primary,
      fontWeight: '800',
      fontSize: 15,
    },
    cardBody: { flex: 1, minWidth: 0 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 15,
      flexShrink: 1,
    },
    email: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    ownerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: c.primarySoft,
      borderColor: 'rgba(240, 64, 0, 0.35)',
    },
    ownerPillText: {
      color: c.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    rolePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
    },
    rolePillText: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    shiftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.success,
    },
    shiftText: {
      ...typography.caption,
      color: c.success,
      fontWeight: '600',
    },

    shiftsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    shiftsIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shiftsTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 15,
    },
    shiftsSub: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
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
      lineHeight: 22,
    },
  }); 