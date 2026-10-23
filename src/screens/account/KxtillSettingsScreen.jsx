// src/screens/account/KxtillSettingsScreen.jsx
//
// KxTill product settings (not organization settings). Reached from
// Account. Owner only.
//
// v3 — floating header + 1:1 skeleton + shared cache:
//   - Uses the shared cache/cache module (readSettingsCache / writeSettingsCache).
//     No defensive local loader, no require, no fallback.
//   - Floating header card: back + monogram + "Owner" chip, identity,
//     three stat chips (currency / timezone short / template), action strip.
//   - Skeleton matches header + section cards 1:1. Empty result shows the
//     real card content, not a shimmer.
//   - Save bar shows "Saving…" text (no spinner).
//   - Stale chip on refresh failure; content preserved. Race-token guard.
//   - Owner gate: still shows the whole screen read-only, not a wall —
//     so non-owners can see settings without editing them.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissions } from '../../hooks/usePermissions';
import kxtillSettingsService from '../../services/kxtillSettings.service';
import {
  readSettingsCache,
  writeSettingsCache,
} from '../../cache/cache';

/* ── constants ─────────────────────────────────────────────────── */

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

/* ── Skeleton primitive ────────────────────────────────────────── */

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

function FieldSkeleton({ styles, withLabel = true }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {withLabel ? (
        <Sk width={70} height={11} r={5} style={{ marginBottom: 8 }} />
      ) : null}
      <Sk
        width="100%"
        height={44}
        r={radius.md}
      />
    </View>
  );
}

function ToggleSkeleton({ styles }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 6 }}>
        <Sk width="40%" height={14} r={6} />
        <Sk width="70%" height={10} r={5} />
      </View>
      <Sk width={44} height={26} r={13} />
    </View>
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

      <View style={styles.actionRow}>
        <Sk width="48%" height={42} r={12} />
        <Sk width="48%" height={42} r={12} />
      </View>
    </View>
  );
}

function BodySkeleton({ styles }) {
  return (
    <View>
      <Sk width={100} height={11} r={5} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />
      <View style={styles.card}>
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
      </View>

      <Sk width={100} height={11} r={5} style={{ marginTop: spacing.xl, marginBottom: spacing.sm }} />
      <View style={styles.card}>
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
        <Sk width={70} height={11} r={5} style={{ marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.lg }}>
          <Sk width="32%" height={36} r={radius.md} />
          <Sk width="32%" height={36} r={radius.md} />
          <Sk width="32%" height={36} r={radius.md} />
        </View>
        <ToggleSkeleton styles={styles} />
        <ToggleSkeleton styles={styles} />
        <ToggleSkeleton styles={styles} />
      </View>

      <Sk width={100} height={11} r={5} style={{ marginTop: spacing.xl, marginBottom: spacing.sm }} />
      <View style={styles.card}>
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
        <FieldSkeleton styles={styles} />
      </View>
    </View>
  );
}

function KxtillSettingsSkeleton({ styles, insets }) {
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

/* ── Floating header ──────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  orgName,
  isOwner,
  draft,
  onBack,
  onSave,
  saving,
  dirty,
}) {
  const monogram = (orgName || 'K').trim().charAt(0).toUpperCase();
  const currency = draft?.currency || 'KES';
  const tz = (draft?.timezone || 'Africa/Nairobi').split('/').pop()?.replace(/_/g, ' ');
  const template = draft?.receiptTemplate || 'classic';

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
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
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
            {orgName || 'KxTill'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            Product settings
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="cash-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue}>{currency}</Text>
          <Text style={styles.statChipLabel}>currency</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="time-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {tz}
          </Text>
          <Text style={styles.statChipLabel}>timezone</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="document-text-outline" size={13} color={c.link} />
          <Text style={styles.statChipValue} numberOfLines={1}>
            {template}
          </Text>
          <Text style={styles.statChipLabel}>receipt</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionPrimary, (!dirty || saving) && { opacity: 0.5 }]}
          onPress={onSave}
          disabled={!dirty || saving || !isOwner}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons
            name={saving ? 'cloud-upload-outline' : 'checkmark'}
            size={14}
            color={c.textOnPrimary}
          />
          <Text style={styles.actionPrimaryText}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Text>
        </TouchableOpacity>
        <View style={styles.actionSecondary}>
          <Ionicons name="information-circle-outline" size={14} color={c.link} />
          <Text style={styles.actionSecondaryText}>
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── Screen ───────────────────────────────────────────────────── */

export default function KxtillSettingsScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { activeOrganization } = useOrganizationContext();
  const { isOwner } = usePermissions();

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);

  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const settingsRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    return EDITABLE_KEYS.some((k) => draft[k] !== settings[k]);
  }, [draft, settings]);

  const load = useCallback(
    async (isRefresh = false) => {
      const orgId = activeOrganization?.id;
      if (!orgId) {
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (settingsRef.current == null) setLoading(true);
      setError(null);

      if (settingsRef.current == null) {
        const cached = await readSettingsCache(orgId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setSettings(cached.payload);
          setDraft(cached.payload);
          setLoading(false);
        }
      }

      try {
        const data = await kxtillSettingsService.getSettings(orgId);
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        setSettings(data);
        setDraft(data);
        setStaleError(null);
        writeSettingsCache(orgId, data);
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Could not load settings';
        if (settingsRef.current != null) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
        }
      }
    },
    [activeOrganization?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const setField = useCallback((key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

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
      const next = { ...settings, ...patch, ...updated };
      setSettings(next);
      setDraft(next);
      writeSettingsCache(activeOrganization.id, next);
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
    if (settings) setDraft(settings);
  }, [settings]);

  if (loading && !settings && !error) {
    return <KxtillSettingsSkeleton styles={styles} insets={insets} />;
  }

  if (error && !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={c.danger}
          />
          <Text style={styles.title}>Could not load</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => load()}
          >
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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
            orgName={activeOrganization?.name}
            isOwner={isOwner}
            draft={draft}
            saving={saving}
            dirty={dirty}
            onBack={() => navigation.goBack()}
            onSave={onSave}
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

          <View style={styles.body}>
            {/* Store info */}
            <Text style={styles.sectionLabel}>STORE INFO</Text>
            <View style={styles.card}>
              <FormField
                c={c}
                label="Shop name"
                value={draft.shopName}
                onChangeText={(v) => setField('shopName', v)}
                placeholder="e.g. Vi-Mini-Mart"
                editable={isOwner}
              />
              <FormField
                c={c}
                label="Phone"
                value={draft.shopPhone}
                onChangeText={(v) => setField('shopPhone', v)}
                placeholder="e.g. 0712345678"
                keyboardType="phone-pad"
                editable={isOwner}
              />
              <FormField
                c={c}
                label="Email"
                value={draft.shopEmail}
                onChangeText={(v) => setField('shopEmail', v)}
                placeholder="e.g. info@shop.co.ke"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={isOwner}
              />
              <FormField
                c={c}
                label="Address"
                value={draft.shopAddress}
                onChangeText={(v) => setField('shopAddress', v)}
                placeholder="e.g. Nairobi, Kenya"
                multiline
                editable={isOwner}
              />
              <FormField
                c={c}
                label="Tax number"
                value={draft.taxNumber || ''}
                onChangeText={(v) => setField('taxNumber', v)}
                placeholder="e.g. P0012345678"
                autoCapitalize="characters"
                editable={isOwner}
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
                editable={isOwner}
              />
              <FormField
                c={c}
                label="Footer"
                value={draft.receiptFooter}
                onChangeText={(v) => setField('receiptFooter', v)}
                placeholder="e.g. Thank you for shopping!"
                editable={isOwner}
              />

              <Text style={styles.fieldLabel}>Template</Text>
              <View style={styles.segment}>
                {RECEIPT_TEMPLATES.map((t) => {
                  const active = draft.receiptTemplate === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      onPress={() => isOwner && setField('receiptTemplate', t.value)}
                      style={[
                        styles.segItem,
                        active && styles.segItemActive,
                        !isOwner && { opacity: 0.6 },
                      ]}
                      disabled={!isOwner}
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
                disabled={!isOwner}
              />
              <ToggleRow
                c={c}
                styles={styles}
                label="Show customer name"
                hint="Print customer name when known"
                value={!!draft.showCustomer}
                onValueChange={(v) => setField('showCustomer', v)}
                disabled={!isOwner}
              />
              <ToggleRow
                c={c}
                styles={styles}
                label="Show cashier name"
                hint="Print who processed the sale"
                value={!!draft.showCashier}
                onValueChange={(v) => setField('showCashier', v)}
                disabled={!isOwner}
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
                disabled={!isOwner}
              />
              <Dropdown
                c={c}
                styles={styles}
                label="Timezone"
                value={draft.timezone}
                options={TIMEZONES}
                onChange={(v) => setField('timezone', v)}
                disabled={!isOwner}
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
                disabled={!isOwner}
              />
              <Dropdown
                c={c}
                styles={styles}
                label="Default payment method"
                value={draft.defaultPaymentMethod}
                options={PAYMENT_METHODS}
                onChange={(v) => setField('defaultPaymentMethod', v)}
                disabled={!isOwner}
              />
            </View>
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
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── field components ────────────────────────────────────────── */

function FormField({ c, label, value, onChangeText, editable = true, ...rest }) {
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
            opacity: editable ? 1 : 0.65,
          },
        ]}
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholderTextColor={c.textMuted}
        selectionColor={c.primary}
        editable={editable}
        {...rest}
      />
    </View>
  );
}

function ToggleRow({ c, styles, label, hint, value, onValueChange, disabled }) {
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
        disabled={disabled}
      />
    </View>
  );
}

function Dropdown({ c, styles, label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const current = opts.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => !disabled && setOpen((v) => !v)}
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: c.background,
            borderColor: c.border,
            opacity: disabled ? 0.65 : 1,
          },
        ]}
        disabled={disabled}
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
      {open && !disabled ? (
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

/* ── style atoms ─────────────────────────────────────────────── */

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
    scroll: { paddingBottom: spacing.xxl * 2 },
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

    // Floating header
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

    identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
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
      fontSize: 12,
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
    actionPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    actionPrimaryText: {
      color: c.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    actionSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    actionSecondaryText: {
      color: c.link,
      fontSize: 12,
      fontWeight: '700',
    },

    // Stale
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

    // Sections
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.4,
      marginTop: spacing.lg,
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
    saveBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });