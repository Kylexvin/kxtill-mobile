// src/screens/branches/BranchSettingsScreen.jsx
//
// v3 — settings context.
//   - Read via useSettings(); no direct kxtillSettingsService call.
//   - updateSettings from context handles optimistic patch + rollback +
//     cache write in one place.
//   - Still uses a per-branch cache in `settings_cache` (branch settings
//     are distinct from org settings).
//   - All toggles, fields, save bar, and owner-only gate preserved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  TextInput,
  Animated,
  Alert,
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
import { usePermissions } from '../../hooks/usePermissions';
import { api } from '../../services/api';
import { readRow, writeRow } from '../../cache/db';

/* ── per-branch settings cache (separate from org settings) ────── */

function branchKey(orgId, branchId) {
  return `branch:${orgId}:${branchId}`;
}

async function readBranchSettingsCache(orgId, branchId) {
  if (!orgId || !branchId) return null;
  const row = await readRow('settings_cache', {
    org_id: branchKey(orgId, branchId),
  });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeBranchSettingsCache(orgId, branchId, payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('settings_cache', {
    org_id: branchKey(orgId, branchId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── Skeleton ─────────────────────────────────────────────────── */

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
        <Sk width={80} height={26} r={13} />
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sk width="60%" height={20} r={8} />
          <Sk width="45%" height={12} r={6} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.chipRow}>
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
        <Sk width="31%" height={32} r={12} />
      </View>

      <Sk width="100%" height={1} r={0} style={{ marginTop: 16 }} />

      <View style={styles.actionRow}>
        <Sk width="48%" height={42} r={12} />
        <Sk width="48%" height={42} r={12} />
      </View>
    </View>
  );
}

function BranchSettingsSkeleton({ styles, insets }) {
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
            <Sk width={130} height={11} r={5} />
            <View style={styles.skCard}>
              <View style={styles.skToggleRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Sk width="40%" height={14} r={6} />
                  <Sk width="80%" height={10} r={5} />
                </View>
                <Sk width={44} height={26} r={13} />
              </View>
              <Sk width="100%" height={1} r={0} style={{ marginTop: 12 }} />
              <View style={styles.skToggleRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Sk width="35%" height={14} r={6} />
                  <Sk width="75%" height={10} r={5} />
                </View>
                <Sk width={44} height={26} r={13} />
              </View>
              <Sk width="100%" height={1} r={0} style={{ marginTop: 12 }} />
              <View style={{ marginTop: 14 }}>
                <Sk width="45%" height={12} r={6} />
                <Sk width="65%" height={10} r={5} style={{ marginTop: 6 }} />
                <Sk width="100%" height={46} r={10} style={{ marginTop: 12 }} />
              </View>
            </View>
          </View>
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
  branchName,
  isOwner,
  draft,
  onBack,
}) {
  const monogram = (branchName || 'B').trim().charAt(0).toUpperCase();
  const shifts = !!draft?.shiftsEnabled;
  const credit = !!draft?.creditEnabled;
  const variance = Number(draft?.varianceThreshold || 0);

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

        <View
          style={[
            styles.statusChip,
            { backgroundColor: isOwner ? c.primarySoft : c.surfaceElevated },
          ]}
        >
          <Ionicons
            name={isOwner ? 'shield-checkmark' : 'lock-closed'}
            size={11}
            color={isOwner ? c.primary : c.textMuted}
          />
          <Text
            style={[
              styles.statusText,
              { color: isOwner ? c.primary : c.textMuted },
            ]}
          >
            {isOwner ? 'Owner' : 'Read only'}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {branchName || 'Branch'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Branch settings
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons
            name="time-outline"
            size={13}
            color={shifts ? c.success : c.textMuted}
          />
          <Text
            style={[
              styles.statChipValue,
              { color: shifts ? c.success : c.textMuted },
            ]}
            numberOfLines={1}
          >
            {shifts ? 'On' : 'Off'}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            shifts
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="card-outline"
            size={13}
            color={credit ? c.success : c.textMuted}
          />
          <Text
            style={[
              styles.statChipValue,
              { color: credit ? c.success : c.textMuted },
            ]}
            numberOfLines={1}
          >
            {credit ? 'On' : 'Off'}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            credit
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="options-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {variance}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            variance
          </Text>
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
            These settings affect only this branch.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── Screen ──────────────────────────────────────────────────── */

export default function BranchSettingsScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { isOwner } = usePermissions();
  // Ensure SettingsProvider is above this screen in the tree. Reading the
  // hook here guarantees the context is mounted; the screen does not need
  // any of the getters (branch settings are separate from org settings),
  // but keeping the hook keeps the invariant obvious.
  useSettings();
  const { branchId, branchName } = route.params || {};

  const [setting, setSetting] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const settingRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    settingRef.current = setting;
  }, [setting]);

  const load = useCallback(
    async (isRefresh = false) => {
      const orgId = activeOrganization?.id;
      if (!orgId || !branchId) {
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (settingRef.current == null) setLoading(true);
      setError(null);

      if (settingRef.current == null) {
        const cached = await readBranchSettingsCache(orgId, branchId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setSetting(cached.payload);
          setDraft(cached.payload);
          setLoading(false);
        }
      }

      try {
        const { data } = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/branches/${branchId}/settings`
        );
        const s = data?.setting || {};
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setSetting(s);
        setDraft(s);
        setStaleError(null);
        writeBranchSettingsCache(orgId, branchId, s);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Could not load branch settings';
        if (settingRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
        }
      }
    },
    [activeOrganization?.id, branchId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!draft || !setting) return false;
    return (
      draft.shiftsEnabled !== setting.shiftsEnabled ||
      Number(draft.varianceThreshold) !==
        Number(setting.varianceThreshold) ||
      draft.creditEnabled !== setting.creditEnabled
    );
  }, [draft, setting]);

  const onSave = async () => {
    if (!dirty || saving || !isOwner) return;
    const threshold = Number(draft.varianceThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      Alert.alert('Invalid threshold', 'Enter a non-negative number.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(
        `/api/v1/organizations/${activeOrganization.id}/kxtill/branches/${branchId}/settings`,
        {
          shiftsEnabled: !!draft.shiftsEnabled,
          varianceThreshold: threshold,
          creditEnabled: !!draft.creditEnabled,
        }
      );
      const s = data?.setting || draft;
      setSetting(s);
      setDraft(s);
      writeBranchSettingsCache(activeOrganization.id, branchId, s);
    } catch (e) {
      Alert.alert(
        'Could not save',
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Something went wrong'
      );
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (setting) setDraft(setting);
  };

  if (loading && !setting && !error) {
    return <BranchSettingsSkeleton styles={styles} insets={insets} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FloatingHeader
            c={c}
            styles={styles}
            insets={insets}
            branchName={branchName}
            isOwner={isOwner}
            draft={draft}
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
            {draft ? (
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Shifts</Text>
                    <Text style={styles.toggleHint}>
                      Cashiers must open a shift before ringing sales
                    </Text>
                  </View>
                  <Switch
                    value={!!draft.shiftsEnabled}
                    onValueChange={(v) =>
                      setDraft({ ...draft, shiftsEnabled: v })
                    }
                    trackColor={{ false: c.border, true: c.primary }}
                    disabled={!isOwner}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Credit (Deni)</Text>
                    <Text style={styles.toggleHint}>
                      Allow credit sales and track customer balances
                    </Text>
                  </View>
                  <Switch
                    value={!!draft.creditEnabled}
                    onValueChange={(v) =>
                      setDraft({ ...draft, creditEnabled: v })
                    }
                    trackColor={{ false: c.border, true: c.primary }}
                    disabled={!isOwner}
                  />
                </View>

                <View style={styles.divider} />

                <Text style={styles.fieldLabel}>Variance threshold</Text>
                <Text style={styles.fieldHint}>
                  Cash variance above this flags the shift for review
                </Text>
                <TextInput
                  style={[styles.input, !isOwner && { opacity: 0.6 }]}
                  value={String(draft.varianceThreshold ?? '')}
                  onChangeText={(v) =>
                    setDraft({
                      ...draft,
                      varianceThreshold: v.replace(/[^0-9.]/g, ''),
                    })
                  }
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor={c.textMuted}
                  selectionColor={c.primary}
                  editable={isOwner}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="settings-outline"
                  size={40}
                  color={c.textMuted}
                />
                <Text style={styles.emptyText}>No settings available.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {dirty && isOwner ? (
          <View style={styles.saveBar}>
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={onDiscard}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving…' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxl * 2 },
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
      fontSize: 13,
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

    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    toggleLabel: {
      ...typography.bodyStrong,
      color: c.textPrimary,
    },
    toggleHint: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    divider: { height: 1, backgroundColor: c.border },
    fieldLabel: {
      ...typography.label,
      color: c.textSecondary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    fieldHint: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },

    saveBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    discardBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    discardText: {
      ...typography.bodyStrong,
      color: c.textSecondary,
    },
    saveBtn: {
      flex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
    },
    saveText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
      fontSize: 15,
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
    },
    emptyText: { ...typography.body, color: c.textMuted },

    skCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    skToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: spacing.sm,
    },
    section: { marginTop: spacing.md },
  });