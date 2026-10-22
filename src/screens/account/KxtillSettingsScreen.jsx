// src/screens/account/KxtillSettingsScreen.jsx
//
// KxTill product settings (not organization settings). Reached from
// Account. Owner only.
//
// Sections: Store info, Receipt, General — matching the fields that
// setting.service.js exposes. Payments (M-Pesa) and org-level settings
// are intentionally not on mobile.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissions } from '../../hooks/usePermissions';
import kxtillSettingsService from '../../services/kxtillSettings.service';

const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'];
const TIMEZONES = [
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'UTC',
];
const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CARD', label: 'Card' },
];
const RECEIPT_TEMPLATES = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
];

const EDITABLE_KEYS = [
  'shopName',
  'shopPhone',
  'shopEmail',
  'shopAddress',
  'taxNumber',
  'receiptHeader',
  'receiptFooter',
  'receiptTemplate',
  'showTax',
  'showCustomer',
  'showCashier',
  'currency',
  'timezone',
  'decimalPlaces',
  'defaultPaymentMethod',
];

export default function KxtillSettingsScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const { activeOrganization } = useOrganizationContext();
  const { isOwner } = usePermissions();

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty = useMemo(() => {
    if (!settings) return false;
    return EDITABLE_KEYS.some((k) => draft[k] !== settings[k]);
  }, [draft, settings]);

  const load = useCallback(async () => {
    if (!activeOrganization?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await kxtillSettingsService.getSettings(
        activeOrganization.id
      );
      setSettings(data);
      setDraft(data);
    } catch (e) {
      setError(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Could not load settings'
      );
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = useCallback(async () => {
    if (!dirty || saving || !isOwner) return;
    setSaving(true);
    try {
      const patch = {};
      for (const k of EDITABLE_KEYS) patch[k] = draft[k];
      const updated = await kxtillSettingsService.updateSettings(
        activeOrganization.id,
        patch
      );
      // Server returns the upserted row — merge back so any server-side
      // normalisation (defaults, numerics) lands in state.
      const next = { ...settings, ...patch, ...updated };
      setSettings(next);
      setDraft(next);
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
  }, [dirty, saving, isOwner, draft, settings, activeOrganization?.id]);

  const onDiscard = useCallback(() => {
    if (!settings) return;
    setDraft(settings);
  }, [settings]);

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={c.textMuted} />
          <Text style={styles.title}>Owner only</Text>
          <Text style={styles.subtitle}>
            Only the organization owner can change KxTill settings.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={c.danger} />
          <Text style={styles.title}>Could not load</Text>
          <Text style={styles.subtitle}>{error || 'Unknown error'}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={load}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>KxTill settings</Text>
        <View style={styles.iconChip} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Store info */}
          <Text style={styles.sectionLabel}>STORE INFO</Text>
          <View style={styles.card}>
            <FormField
              c={c}
              label="Shop name"
              value={draft.shopName}
              onChangeText={(v) => setField('shopName', v)}
              placeholder="e.g. Vi-Mini-Mart"
            />
            <FormField
              c={c}
              label="Phone"
              value={draft.shopPhone}
              onChangeText={(v) => setField('shopPhone', v)}
              placeholder="e.g. 0712345678"
              keyboardType="phone-pad"
            />
            <FormField
              c={c}
              label="Email"
              value={draft.shopEmail}
              onChangeText={(v) => setField('shopEmail', v)}
              placeholder="e.g. info@shop.co.ke"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              c={c}
              label="Address"
              value={draft.shopAddress}
              onChangeText={(v) => setField('shopAddress', v)}
              placeholder="e.g. Nairobi, Kenya"
              multiline
            />
            <FormField
              c={c}
              label="Tax number"
              value={draft.taxNumber || ''}
              onChangeText={(v) => setField('taxNumber', v)}
              placeholder="e.g. P0012345678"
              autoCapitalize="characters"
            />
          </View>

          {/* Receipt */}
          <Text style={styles.sectionLabel}>RECEIPT</Text>
          <View style={styles.card}>
            <FormField
              c={c}
              label="Header"
              value={draft.receiptHeader}
              onChangeText={(v) => setField('receiptHeader', v)}
              placeholder="e.g. Vi-Mini-Mart"
            />
            <FormField
              c={c}
              label="Footer"
              value={draft.receiptFooter}
              onChangeText={(v) => setField('receiptFooter', v)}
              placeholder="e.g. Thank you for shopping!"
            />

            <Text style={styles.fieldLabel}>Template</Text>
            <View style={styles.segment}>
              {RECEIPT_TEMPLATES.map((t) => {
                const active = draft.receiptTemplate === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setField('receiptTemplate', t.value)}
                    style={[styles.segItem, active && styles.segItemActive]}
                  >
                    <Text
                      style={[
                        styles.segText,
                        active && styles.segTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ToggleRow
              c={c}
              styles={styles}
              label="Show tax line"
              hint="Display VAT / tax breakdown"
              value={!!draft.showTax}
              onValueChange={(v) => setField('showTax', v)}
            />
            <ToggleRow
              c={c}
              styles={styles}
              label="Show customer name"
              hint="Print customer name when known"
              value={!!draft.showCustomer}
              onValueChange={(v) => setField('showCustomer', v)}
            />
            <ToggleRow
              c={c}
              styles={styles}
              label="Show cashier name"
              hint="Print who processed the sale"
              value={!!draft.showCashier}
              onValueChange={(v) => setField('showCashier', v)}
            />
          </View>

          {/* General */}
          <Text style={styles.sectionLabel}>GENERAL</Text>
          <View style={styles.card}>
            <Dropdown
              c={c}
              styles={styles}
              label="Currency"
              value={draft.currency}
              options={CURRENCIES}
              onChange={(v) => setField('currency', v)}
            />
            <Dropdown
              c={c}
              styles={styles}
              label="Timezone"
              value={draft.timezone}
              options={TIMEZONES}
              onChange={(v) => setField('timezone', v)}
            />
            <Dropdown
              c={c}
              styles={styles}
              label="Decimal places"
              value={String(draft.decimalPlaces ?? 2)}
              options={[
                { value: '0', label: '0 — whole numbers' },
                { value: '1', label: '1 decimal' },
                { value: '2', label: '2 decimals' },
              ]}
              onChange={(v) => setField('decimalPlaces', Number(v))}
            />
            <Dropdown
              c={c}
              styles={styles}
              label="Default payment method"
              value={draft.defaultPaymentMethod}
              options={PAYMENT_METHODS}
              onChange={(v) => setField('defaultPaymentMethod', v)}
            />
          </View>
        </ScrollView>

        {dirty ? (
          <View style={styles.saveBar}>
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={onDiscard}
              disabled={saving}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.textOnPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ c, label, value, onChangeText, ...rest }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[formLabel, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          formInput,
          {
            color: c.textPrimary,
            backgroundColor: c.background,
            borderColor: c.border,
          },
        ]}
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholderTextColor={c.textMuted}
        selectionColor={c.primary}
        {...rest}
      />
    </View>
  );
}

function ToggleRow({ c, styles, label, hint, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.primary }}
        thumbColor="#fff"
        ios_backgroundColor={c.border}
      />
    </View>
  );
}

function Dropdown({ c, styles, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const current = opts.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.dropdownTrigger,
          { backgroundColor: c.background, borderColor: c.border },
        ]}
      >
        <Text style={styles.dropdownValue}>
          {current?.label || value || 'Select…'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={c.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.dropdownList,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {opts.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[
                  styles.dropdownItem,
                  active && { backgroundColor: c.primarySoft },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    active && { color: c.primary, fontWeight: '800' },
                  ]}
                >
                  {o.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={16} color={c.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const formLabel = {
  fontSize: 11,
  fontWeight: '800',
  letterSpacing: 1.2,
  marginBottom: 6,
};
const formInput = {
  fontSize: 15,
  fontWeight: '600',
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 12,
  borderWidth: 1,
};

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: {
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
    },
    headerTitle: { ...typography.bodyStrong, color: c.textPrimary },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl * 2,
    },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.4,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    title: {
      ...typography.h2,
      color: c.textPrimary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 22,
    },
    primaryBtn: {
      marginTop: spacing.xl,
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    },
    primaryBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
    fieldLabel: {
      ...typography.label,
      color: c.textSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0.4,
    },
    segment: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: spacing.lg,
    },
    segItem: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: radius.md,
    },
    segItemActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    segText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segTextActive: { color: c.textOnPrimary },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    toggleLabel: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    toggleHint: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    dropdownValue: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: '600',
    },
    dropdownList: {
      marginTop: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dropdownItemText: {
      ...typography.body,
      color: c.textPrimary,
    },
    saveBar: {
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
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
    },
    saveBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });