// src/screens/inventory/ProductFormScreen.jsx
//
// Product create / edit. One- or two-step flow depending on the medicine
// toggle. Floating header with live progress ring, inline validation,
// toast on save.
//
// Progress is computed against the FULL required set for the current
// mode, so the ring is 100% only when the actual submission is valid:
//   - retail product: 5 required fields (name, category, price, unit)
//   - medicine (on pharmacy org + toggle on): + genericName, strength
//
// Category and Unit both have tappable presets. Tap to fill; type to
// override.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
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
import { usePermissionsContext } from '../../context/PermissionsContext';
import { useSettings } from '../../context/SettingsContext';
import inventoryService from '../../services/inventory.service';
import { KXTILL } from '../../constants/permissions';

/* ── constants ──────────────────────────────────────────────── */

const BLANK = {
  name: '',
  sku: '',
  barcode: '',  
  category: '',
  cost: '',
  price: '',
  unitName: 'Piece',
  unitAbbr: 'pc',
  minStock: '',
  trackInventory: true,
  isMedicine: false,
  genericName: '',
  strength: '',
  dosageForm: 'CAPSULE',
};

const CATEGORY_PRESETS = [
  // Retail / general
  'Beverages',
  'Snacks',
  'Groceries',
  'Bakery',
  'Household',
  'Hygiene',
  'Personal Care',
  'Electronics',
  'Stationery',
  'Clothing',
  'Other',

  // Pharmacy
  'Antibiotics',
  'Analgesics',
  'Antimalarials',
  'Antihistamines',
  'Vitamins',
  'Supplements',
  'First Aid',
  'Medical Supplies',
];

const UNIT_PRESETS = [
  // Most used first
  { name: 'Piece', abbr: 'pc' },
  { name: 'Bottle', abbr: 'btl' },
  { name: 'Pack', abbr: 'pkt' },
  { name: 'Box', abbr: 'box' },
  { name: 'Kg', abbr: 'kg' },
  { name: 'Litre', abbr: 'L' },
  { name: 'Gram', abbr: 'g' },
  { name: 'Bag', abbr: 'bag' },
  { name: 'Sachet', abbr: 'sch' },

  // Countable
  { name: 'Dozen', abbr: 'dz' },
  { name: 'Tray', abbr: 'tray' },
  { name: 'Carton', abbr: 'ctn' },
  { name: 'Crate', abbr: 'crt' },
  { name: 'Bundle', abbr: 'bdl' },
  { name: 'Roll', abbr: 'roll' },
  { name: 'Sheet', abbr: 'sht' },
  { name: 'Pair', abbr: 'pr' },

  // Containers / food
  { name: 'Can', abbr: 'can' },
  { name: 'Jar', abbr: 'jar' },
  { name: 'Tin', abbr: 'tin' },
  { name: 'Tube', abbr: 'tube' },
  { name: 'Bar', abbr: 'bar' },
  { name: 'Loaf', abbr: 'loaf' },
  { name: 'Cup', abbr: 'cup' },
  { name: 'Glass', abbr: 'gls' },
  { name: 'Scoop', abbr: 'scoop' },

  // Weight
  { name: 'Milligram', abbr: 'mg' },
  { name: 'Tonne', abbr: 't' },

  // Volume
  { name: 'Millilitre', abbr: 'mL' },
  { name: 'Gallon', abbr: 'gal' },

  // Length
  { name: 'Metre', abbr: 'm' },
  { name: 'Centimetre', abbr: 'cm' },
  { name: 'Inch', abbr: 'in' },
  { name: 'Foot', abbr: 'ft' },

  // Pharmacy
  { name: 'Tablet', abbr: 'tab' },
  { name: 'Capsule', abbr: 'cap' },
  { name: 'Vial', abbr: 'vial' },
  { name: 'Ampoule', abbr: 'amp' },
  { name: 'Strip', abbr: 'strip' },
  { name: 'Dose', abbr: 'dose' },

  // Service
  { name: 'Hour', abbr: 'hr' },
  { name: 'Day', abbr: 'day' },
  { name: 'Session', abbr: 'ses' },
  { name: 'Service', abbr: 'svc' },
];

const DOSAGE_FORMS = [
  'CAPSULE',
  'TABLET',
  'SYRUP',
  'SUSPENSION',
  'SOLUTION',
  'INJECTION',
  'INFUSION',
  'CREAM',
  'OINTMENT',
  'GEL',
  'LOTION',
  'DROPS',
  'SUPPOSITORY',
  'INHALER',
  'PATCH',
  'POWDER',
  'SPRAY',
  'OTHER',
];

/* ── progress ring ─────────────────────────────────────────── */

function ProgressRing({
  progress,
  size = 36,
  stroke = 3,
  trackColor,
  fillColor,
}) {
  const pct = Math.max(0, Math.min(1, progress));
  const filled = pct >= 0.999;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: filled ? fillColor : trackColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {filled ? (
        <Ionicons name="checkmark" size={size * 0.5} color={fillColor} />
      ) : (
        <Text
          style={{
            fontSize: 10,
            fontWeight: '900',
            color: fillColor,
            fontVariant: ['tabular-nums'],
          }}
        >
          {Math.round(pct * 100)}
        </Text>
      )}
    </View>
  );
}

/* ── toast ──────────────────────────────────────────────────── */

function Toast({ c, text, tone = 'success', onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    if (!text) return undefined;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => onHide?.());
    }, 2200);
    return () => clearTimeout(t);
  }, [text, opacity, translateY, onHide]);

  if (!text) return null;
  const bg =
    tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.success;
  const icon =
    tone === 'danger'
      ? 'alert-circle'
      : tone === 'warning'
        ? 'warning'
        : 'checkmark-circle';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: spacing.xl,
        right: spacing.xl,
        bottom: spacing.xxl,
        opacity,
        transform: [{ translateY }],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: bg,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      <Text
        style={{ color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/* ── preset chip rows ──────────────────────────────────────── */

function CategoryPresets({ styles, value, presets, onPick }) {
  const list = presets && presets.length > 0 ? presets : CATEGORY_PRESETS;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8,
        paddingVertical: 4,
        paddingRight: 8,
      }}
      style={{ marginBottom: 8 }}
    >
      {list.map((cat) => {
        const active = value?.toLowerCase() === cat.toLowerCase();
        return (
          <Pressable
            key={cat}
            onPress={() => onPick(cat)}
            style={[styles.presetPill, active && styles.presetPillActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.presetPillLabel,
                active && styles.presetPillLabelActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function UnitPresets({ styles, value, onPick }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 8,
        paddingVertical: 4,
        paddingRight: 8,
      }}
      style={{ marginBottom: 8 }}
    >
      {UNIT_PRESETS.map((u) => {
        const active =
          value?.name?.toLowerCase() === u.name.toLowerCase() &&
          value?.abbr?.toLowerCase() === u.abbr.toLowerCase();
        return (
          <Pressable
            key={u.name}
            onPress={() => onPick(u)}
            style={[styles.presetPill, active && styles.presetPillActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.presetPillLabel,
                active && styles.presetPillLabelActive,
              ]}
            >
              {u.name}
            </Text>
            <Text
              style={[
                styles.presetPillAbbr,
                active && styles.presetPillAbbrActive,
              ]}
            >
              {u.abbr}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ── screen ──────────────────────────────────────────────────── */

export default function ProductFormScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, productInstances } = useOrganizationContext();
  const { can } = usePermissionsContext();
  const { getCurrency } = useSettings();

  const mode = route.params?.mode || 'create';
  const initial = route.params?.product || null;
  const initialBarcode = route.params?.initialBarcode || null;

  const isPharmacyOrg = useMemo(
    () => productInstances?.some((i) => i.vertical === 'pharmacy'),
    [productInstances]
  );
  const canCreate = can(KXTILL.INVENTORY.CREATE);
  const canUpdate = can(KXTILL.INVENTORY.UPDATE);
  const allowed = mode === 'create' ? canCreate : canUpdate;

const [form, setForm] = useState(() => {
  if (!initial) {
    return { ...BLANK, barcode: initialBarcode || '' };
  }
  const bu = initial.baseUnit || {};
  const ph = initial.pharmacyProduct || {};
  return {
    name: initial.name || '',
    sku: initial.sku || '',
    category: initial.category || '',
    cost: String(initial.cost ?? ''),
    price: String(bu.price ?? initial.price ?? ''),
    unitName: bu.name || 'Piece',
    unitAbbr: bu.abbreviation || 'pc',
    barcode: bu.barcode || '',            // ← ADD
    minStock: String(initial.branchProducts?.[0]?.minStock ?? ''),
    trackInventory: initial.trackInventory !== false,
    isMedicine: !!initial.pharmacyProduct,
    genericName: ph.genericName || '',
    strength: ph.strength || '',
    dosageForm: ph.dosageForm || 'CAPSULE',
  };
});

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPhase, setSubmittingPhase] = useState(null);
  const [err, setErr] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (fieldErrors[k]) {
      setFieldErrors((fe) => {
        const next = { ...fe };
        delete next[k];
        return next;
      });
    }
  };

  const touchField = (k) => () => {
    const check = validateField(k);
    if (check) setFieldErrors((fe) => ({ ...fe, [k]: check }));
  };

  const validateField = (k) => {
    switch (k) {
      case 'name':
        return form.name.trim() ? null : 'Product name is required';
      case 'category':
        return form.category.trim() ? null : 'Category is required';
      case 'price':
        return form.price && !Number.isNaN(Number(form.price))
          ? null
          : 'Base price is required';
      case 'unitName':
        return form.unitName.trim() ? null : 'Unit name is required';
      case 'unitAbbr':
        return form.unitAbbr.trim()
          ? null
          : 'Unit abbreviation is required';
      case 'genericName':
        return form.genericName.trim() ? null : 'Generic name is required';
      case 'strength':
        return form.strength.trim() ? null : 'Strength is required';
      default:
        return null;
    }
  };

  // The form is 1- or 2-step depending on the medicine toggle.
  // Progress is computed against the FULL set so the ring is honest.
  const needsMedicineStep = form.isMedicine && isPharmacyOrg;

  const requiredFields = useMemo(() => {
    const list = ['name', 'category', 'price', 'unitName', 'unitAbbr'];
    if (needsMedicineStep) list.push('genericName', 'strength');
    return list;
  }, [needsMedicineStep]);

  const completion = useMemo(() => {
    const ok = requiredFields.filter((k) => !validateField(k));
    return requiredFields.length === 0
      ? 0
      : ok.length / requiredFields.length;
  }, [requiredFields, form]); // eslint-disable-line react-hooks/exhaustive-deps

  const ringProgress = completion;

  const validateAll = () => {
    const errs = {};
    for (const k of requiredFields) {
      const check = validateField(k);
      if (check) errs[k] = check;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = Object.values(errs)[0];
      setErr(first);
      return false;
    }
    setErr(null);
    return true;
  };

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      cost: form.cost ? Number(form.cost) : 0,
      trackInventory: form.trackInventory,
      baseUnit: {
        name: form.unitName.trim(),
        abbreviation: form.unitAbbr.trim(),
        barcode: form.barcode?.trim() || undefined, 
        price: Number(form.price),
      },
    };
    if (form.sku.trim()) payload.sku = form.sku.trim();
    if (form.minStock.trim() && !Number.isNaN(Number(form.minStock))) {
      payload.minStock = Number(form.minStock);
    }
    if (form.isMedicine && isPharmacyOrg) {
      payload.pharmacy = {
        genericName: form.genericName.trim(),
        strength: form.strength.trim(),
        dosageForm: form.dosageForm.trim(),
      };
    }
    return payload;
  };

  const onContinue = () => {
    if (!validateAll()) return;
    if (form.isMedicine && isPharmacyOrg) {
      setStep(2);
    } else {
      submit();
    }
  };

  const onBack = () => {
    if (step === 2) {
      setStep(1);
      setErr(null);
      setFieldErrors({});
      return;
    }
    navigation.goBack();
  };

  const submit = async () => {
    if (!validateAll()) return;
    if (!allowed || !activeOrganization?.id) return;

    setSubmitting(true);
    setSubmittingPhase('saving');
    try {
      const payload = buildPayload();
      if (mode === 'edit' && initial?.id) {
        await inventoryService.updateProduct(
          activeOrganization.id,
          initial.id,
          payload
        );
      } else {
        await inventoryService.createProduct(
          activeOrganization.id,
          payload
        );
      }
      setToast({
        text: mode === 'edit' ? 'Product updated' : 'Product created',
        tone: 'success',
      });
      setTimeout(() => navigation.goBack(), 600);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Failed to save product';
      setErr(msg);
      setToast({ text: msg, tone: 'danger' });
    } finally {
      setSubmitting(false);
      setSubmittingPhase(null);
    }
  };

  const toggleMedicine = () => {
    const next = !form.isMedicine;
    set('isMedicine', next);
    if (!next) {
      // Clear medicine-only field errors — they're no longer relevant.
      setFieldErrors((fe) => {
        const copy = { ...fe };
        delete copy.genericName;
        delete copy.strength;
        return copy;
      });
      // If the user was on step 2 and turned medicine off, snap back
      // to step 1 so the flow makes sense.
      if (step === 2) {
        setStep(1);
        setErr(null);
      }
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.denied}>
          <Ionicons
            name="lock-closed-outline"
            size={40}
            color={c.textMuted}
          />
          <Text style={styles.deniedTitle}>
            You don't have permission
          </Text>
          <Text style={styles.deniedSub}>
            Ask an owner to grant inventory access.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.deniedBtn}
          >
            <Text style={{ color: c.textOnPrimary, fontWeight: '800' }}>
              Close
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currency = getCurrency();
  const primaryLabel = submitting
    ? submittingPhase === 'saving'
      ? 'Saving…'
      : 'Uploading…'
    : step === 1
      ? form.isMedicine && isPharmacyOrg
        ? 'Continue'
        : mode === 'edit'
          ? 'Save changes'
          : 'Create product'
      : mode === 'edit'
        ? 'Save changes'
        : 'Create product';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 32 + Math.max(insets.bottom, 12) + 64 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
            <View pointerEvents="none" style={styles.headerGlow} />

            <View style={styles.headerTop}>
              <Pressable
                onPress={onBack}
                hitSlop={10}
                style={styles.headerIcon}
                accessibilityRole="button"
                accessibilityLabel={step === 2 ? 'Back' : 'Close'}
              >
                <Ionicons
                  name={step === 2 ? 'arrow-back' : 'close'}
                  size={18}
                  color={c.textPrimary}
                />
              </Pressable>

              <ProgressRing
                progress={ringProgress}
                size={36}
                stroke={3}
                trackColor={c.border}
                fillColor={c.primary}
              />
            </View>

            <Text style={styles.headerName} numberOfLines={1}>
              {mode === 'edit' ? 'Edit product' : 'New product'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {step === 1
                ? 'Basics · name, price, unit'
                : 'Medicine · pharmacy metadata'}
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(ringProgress * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.body}>
            {err ? (
              <View style={styles.errBox}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={c.danger}
                />
                <Text style={styles.errText} numberOfLines={3}>
                  {err}
                </Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Field
                  label="Product name"
                  required
                  error={fieldErrors.name}
                  styles={styles}
                  c={c}
                >
                  <TextInput
                    value={form.name}
                    onChangeText={(v) => set('name', v)}
                    onBlur={touchField('name')}
                    placeholder="e.g. Apple Juice 1L"
                    placeholderTextColor={c.textMuted}
                    style={styles.input}
                  />
                </Field>

                {/* ── Category: chips + editable input ── */}
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Category<Text style={{ color: c.danger }}> *</Text>
                    </Text>
                    {fieldErrors.category ? (
                      <Text style={styles.fieldError} numberOfLines={1}>
                        {fieldErrors.category}
                      </Text>
                    ) : null}
                  </View>
                  <CategoryPresets
                    styles={styles}
                    value={form.category}
                    presets={CATEGORY_PRESETS}
                    onPick={(cat) => {
                      set('category', cat);
                      setFieldErrors((fe) => {
                        const next = { ...fe };
                        delete next.category;
                        return next;
                      });
                    }}
                  />
                  <View
                    style={[
                      styles.inputWrap,
                      fieldErrors.category && {
                        borderColor: c.danger,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <TextInput
                      value={form.category}
                      onChangeText={(v) => set('category', v)}
                      onBlur={touchField('category')}
                      placeholder="e.g. Beverages"
                      placeholderTextColor={c.textMuted}
                      style={styles.input}
                    />
                  </View>
                </View>

                <Field label="SKU" optional styles={styles} c={c}>
                  <TextInput
                    value={form.sku}
                    onChangeText={(v) => set('sku', v)}
                    placeholder="e.g. APJ-001"
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                </Field>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Base price"
                      required
                      error={fieldErrors.price}
                      prefix={currency}
                      styles={styles}
                      c={c}
                    >
                      <TextInput
                        value={form.price}
                        onChangeText={(v) => set('price', v)}
                        onBlur={touchField('price')}
                        placeholder="0.00"
                        placeholderTextColor={c.textMuted}
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Cost"
                      optional
                      prefix={currency}
                      styles={styles}
                      c={c}
                    >
                      <TextInput
                        value={form.cost}
                        onChangeText={(v) => set('cost', v)}
                        placeholder="0.00"
                        placeholderTextColor={c.textMuted}
                        keyboardType="decimal-pad"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                </View>

                {/* ── Unit: chips + two editable fields ── */}
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Unit<Text style={{ color: c.danger }}> *</Text>
                    </Text>
                    {fieldErrors.unitName || fieldErrors.unitAbbr ? (
                      <Text style={styles.fieldError} numberOfLines={1}>
                        {fieldErrors.unitName || fieldErrors.unitAbbr}
                      </Text>
                    ) : null}
                  </View>

                  <UnitPresets
                    styles={styles}
                    value={{ name: form.unitName, abbr: form.unitAbbr }}
                    onPick={(u) => {
                      set('unitName', u.name);
                      set('unitAbbr', u.abbr);
                      setFieldErrors((fe) => {
                        const next = { ...fe };
                        delete next.unitName;
                        delete next.unitAbbr;
                        return next;
                      });
                    }}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View
                      style={[
                        styles.inputWrap,
                        { flex: 1 },
                        fieldErrors.unitName && {
                          borderColor: c.danger,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <TextInput
                        value={form.unitName}
                        onChangeText={(v) => set('unitName', v)}
                        onBlur={touchField('unitName')}
                        placeholder="Piece"
                        placeholderTextColor={c.textMuted}
                        style={styles.input}
                      />
                    </View>
                    <View
                      style={[
                        styles.inputWrap,
                        { width: 100 },
                        fieldErrors.unitAbbr && {
                          borderColor: c.danger,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <TextInput
                        value={form.unitAbbr}
                        onChangeText={(v) => set('unitAbbr', v)}
                        onBlur={touchField('unitAbbr')}
                        placeholder="pc"
                        placeholderTextColor={c.textMuted}
                        style={styles.input}
                      />
                    </View>
                  </View>
                </View>
<Field label="Barcode" optional styles={styles} c={c}>
  <TextInput
    value={form.barcode}
    onChangeText={(v) => set('barcode', v)}
    placeholder="e.g. 2000000000015"
    placeholderTextColor={c.textMuted}
    keyboardType="number-pad"
    autoCapitalize="none"
    autoCorrect={false}
    style={styles.input}
  />
</Field>
                <Field
                  label="Min stock"
                  optional
                  styles={styles}
                  c={c}
                >
                  <TextInput
                    value={form.minStock}
                    onChangeText={(v) => set('minStock', v)}
                    placeholder="e.g. 5"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>

                {isPharmacyOrg ? (
                  <Pressable
                    onPress={toggleMedicine}
                    style={styles.toggleRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>
                        This is a medicine
                      </Text>
                      <Text style={styles.toggleSub}>
                        Adds pharmacy details (generic, strength, form)
                      </Text>
                    </View>
                    <Ionicons
                      name={form.isMedicine ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={form.isMedicine ? c.primary : c.textMuted}
                    />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <Field
                  label="Generic name"
                  required
                  error={fieldErrors.genericName}
                  styles={styles}
                  c={c}
                >
                  <TextInput
                    value={form.genericName}
                    onChangeText={(v) => set('genericName', v)}
                    onBlur={touchField('genericName')}
                    placeholder="e.g. Amoxicillin"
                    placeholderTextColor={c.textMuted}
                    style={styles.input}
                  />
                </Field>

                <Field
                  label="Strength"
                  required
                  error={fieldErrors.strength}
                  styles={styles}
                  c={c}
                >
                  <TextInput
                    value={form.strength}
                    onChangeText={(v) => set('strength', v)}
                    onBlur={touchField('strength')}
                    placeholder="e.g. 250mg"
                    placeholderTextColor={c.textMuted}
                    style={styles.input}
                  />
                </Field>

                <Field label="Dosage form" required styles={styles} c={c}>
                  <View style={styles.chipRow}>
                    {DOSAGE_FORMS.map((d) => {
                      const active = form.dosageForm === d;
                      return (
                        <Pressable
                          key={d}
                          onPress={() => set('dosageForm', d)}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && styles.pillTextActive,
                            ]}
                          >
                            {d.charAt(0) + d.slice(1).toLowerCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
              </>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={step === 1 ? onContinue : submit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
              submitting && { opacity: 0.6 },
            ]}
          >
            {submitting ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <ActivityIndicator color={c.textOnPrimary} />
                <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            )}
          </Pressable>
        </View>

        <Toast
          c={c}
          text={toast?.text}
          tone={toast?.tone}
          onHide={() => setToast(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  styles,
  c,
  optional,
  required,
  error,
  prefix,
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>
          {label}
          {required ? (
            <Text style={{ color: c.danger }}> *</Text>
          ) : optional ? (
            <Text style={{ color: c.textMuted }}>  optional</Text>
          ) : null}
        </Text>
        {error ? (
          <Text style={styles.fieldError} numberOfLines={1}>
            {error}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.inputWrap,
          error && { borderColor: c.danger, borderWidth: 1 },
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        {children}
      </View>
    </View>
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
      marginBottom: 14,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerName: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    headerSub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginTop: 14,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: c.primary,
    },

    field: { marginBottom: 14 },
    fieldLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    fieldLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
    },
    fieldError: {
      color: c.danger,
      fontSize: 11,
      fontWeight: '700',
      maxWidth: '60%',
      textAlign: 'right',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surfaceElevated,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    prefix: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      color: c.textPrimary,
      fontSize: 15,
    },

    row: { flexDirection: 'row', gap: 12 },

    // Preset chips
    presetPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    presetPillActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    presetPillLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textPrimary,
    },
    presetPillLabelActive: { color: c.textOnPrimary },
    presetPillAbbr: {
      fontSize: 10,
      fontWeight: '800',
      color: c.textMuted,
      letterSpacing: 0.3,
    },
    presetPillAbbrActive: { color: c.textOnPrimary, opacity: 0.85 },

    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.surfaceElevated,
      marginTop: 4,
    },
    toggleTitle: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    toggleSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    pillActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    pillText: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: '700',
    },
    pillTextActive: { color: c.textOnPrimary },

    errBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },

    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    primaryBtn: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '800',
    },

    denied: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: spacing.xl,
    },
    deniedTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 8,
    },
    deniedSub: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
    deniedBtn: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
  });