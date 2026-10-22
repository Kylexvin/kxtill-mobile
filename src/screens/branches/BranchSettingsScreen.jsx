// src/screens/branches/BranchSettingsScreen.jsx
//
// Per-branch settings: shifts enabled, variance threshold, credit.
// Reuses existing shift setting endpoints. Owner-editable.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { api } from '../../services/api';

export default function BranchSettingsScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();
  const { branchId, branchName } = route.params || {};

  const [setting, setSetting] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!activeOrganization?.id || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/api/v1/organizations/${activeOrganization.id}/kxtill/branches/${branchId}/settings`
      );
      const s = data?.setting || {};
      if (mountedRef.current) {
        setSetting(s);
        setDraft(s);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            'Could not load branch settings'
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeOrganization?.id, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    draft &&
    setting &&
    (draft.shiftsEnabled !== setting.shiftsEnabled ||
      Number(draft.varianceThreshold) !== Number(setting.varianceThreshold) ||
      draft.creditEnabled !== setting.creditEnabled);

  const onSave = async () => {
    if (!dirty || saving) return;
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
      <ScrollView contentContainerStyle={styles.scroll}>
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
            Branch settings
          </Text>
          <View style={styles.iconChip} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>SETTINGS</Text>
          <Text style={styles.title} numberOfLines={1}>
            {branchName || 'Branch'}
          </Text>
          <Text style={styles.subtitle}>
            These settings affect only this branch.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {draft ? (
          <>
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
                  onValueChange={(v) => setDraft({ ...draft, shiftsEnabled: v })}
                  trackColor={{ false: c.border, true: c.primary }}
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
                />
              </View>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>Variance threshold</Text>
              <Text style={styles.fieldHint}>
                Cash variance above this flags the shift for review
              </Text>
              <TextInput
                style={styles.input}
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
              />
            </View>

            {dirty ? (
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={onSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={styles.saveText}>Save changes</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
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
    divider: {
      height: 1,
      backgroundColor: c.border,
    },
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
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.lg,
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
  });