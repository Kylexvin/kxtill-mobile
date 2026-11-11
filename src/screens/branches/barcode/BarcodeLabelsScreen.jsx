// src/screens/branches/barcode/BarcodeLabelsScreen.jsx
//
// Branch operation: print barcode labels.
// Step 1 Pick (products → units/variants) → Step 2 Options + copies → Step 3 Generate.
// Barcodes themselves are created org-wide in BarcodeSearch; this screen only prints.
// Flow: bwip-js → HTML → expo-print → share sheet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import bwipjs from '@bwip-js/react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import inventoryService from '../../../services/inventory.service';

const LABELS_PER_PAGE = 24; // 3 cols × 8 rows
const MAX_LABELS = 480; // 20 pages — keeps the PDF render safe on low-end phones
const STEPS = ['Pick', 'Options', 'Generate'];

function toast(msg) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* rows: selected entries (each has .copies). imageMap: { [unitId]: dataUrl } */
function buildHtml(rows, options, imageMap) {
  const expanded = rows.flatMap((r) => Array.from({ length: r.copies }, () => r));
  const cells = expanded
    .map((r) => {
      const img = imageMap[r.unitId];
      const lines = [];
      if (options.showName && r.productName)
        lines.push(`<div class="name">${escapeHtml(r.productName)}</div>`);
      if (options.showUnitLabel && r.unitName)
        lines.push(
          `<div class="unit">${escapeHtml(r.unitName)}${
            r.unitAbbr ? ` · ${escapeHtml(r.unitAbbr)}` : ''
          }</div>`
        );
      if (options.showPrice && r.price)
        lines.push(`<div class="price">${escapeHtml(r.price)}</div>`);
      if (options.showSku && r.sku)
        lines.push(`<div class="sku">${escapeHtml(r.sku)}</div>`);
      return `
        <div class="label">
          ${img ? `<img src="${img}" class="bc" />` : '<div class="bc missing">no barcode image</div>'}
          ${lines.join('')}
        </div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 38.1mm; gap: 2mm; }
  .label { border: 0.3mm dashed #d4d4d8; padding: 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .bc { width: 100%; max-height: 20mm; object-fit: contain; }
  .bc.missing { font-size: 8px; color: #b91c1c; text-align: center; }
  .name { font-size: 9px; font-weight: 700; margin-top: 1mm; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .unit { font-size: 8px; color: #52525b; margin-top: 0.5mm; text-align: center; }
  .price { font-size: 9px; font-weight: 800; margin-top: 0.5mm; }
  .sku { font-size: 7px; color: #71717a; margin-top: 0.5mm; }
</style>
</head>
<body><div class="grid">${cells}</div></body>
</html>`;
}

const toEntry = (p, u) => ({
  unitId: u.id,
  productId: p.id,
  productName: p.name,
  sku: p.sku,
  price: u.price,
  unitName: u.name,
  unitAbbr: u.abbreviation,
  barcode: u.barcode,
  copies: 1,
});

export default function BarcodeLabelsScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, activeBranch } = useOrganizationContext();

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({}); // { [productId]: bool }
  // Full entries, not just ids, so picks survive a new search.
  const [selected, setSelected] = useState({}); // { [unitId]: entry }
  const [options, setOptions] = useState({
    showName: true,
    showPrice: true,
    showUnitLabel: true,
    showSku: false,
  });
  const [generating, setGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState(null);

  const mountedRef = useRef(true);
  const reqRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (searchText) => {
      if (!activeOrganization?.id) return;
      const req = ++reqRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await inventoryService.getProducts(activeOrganization.id, {
          search: searchText || undefined,
          limit: 50,
          branchId: activeBranch?.id, // ignored if the service doesn't support it
        });
        if (!mountedRef.current || req !== reqRef.current) return;
        setProducts(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (mountedRef.current && req === reqRef.current)
          setError(e?.response?.data?.message || 'Could not load products');
      } finally {
        if (mountedRef.current && req === reqRef.current) setLoading(false);
      }
    },
    [activeOrganization?.id, activeBranch?.id]
  );

  // One debounced effect: immediate when the box is empty, 300ms while typing.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => load(q), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  /* ── selection helpers ── */
  const readyUnits = (p) => (p.units || []).filter((u) => !!u.barcode);

  const toggleUnit = (p, u) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = toEntry(p, u);
      return next;
    });

  const toggleProduct = (p) => {
    const ready = readyUnits(p);
    if (ready.length === 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      const all = ready.every((u) => next[u.id]);
      ready.forEach((u) => {
        if (all) delete next[u.id];
        else if (!next[u.id]) next[u.id] = toEntry(p, u);
      });
      return next;
    });
  };

  const selectAllVisible = () =>
    setSelected((prev) => {
      const next = { ...prev };
      products.forEach((p) =>
        readyUnits(p).forEach((u) => {
          if (!next[u.id]) next[u.id] = toEntry(p, u);
        })
      );
      return next;
    });

  const clearAll = () => setSelected({});

  const setCopies = (unitId, delta) =>
    setSelected((prev) => {
      const cur = prev[unitId];
      if (!cur) return prev;
      const copies = Math.min(99, Math.max(1, cur.copies + delta));
      return { ...prev, [unitId]: { ...cur, copies } };
    });

  const rows = useMemo(() => Object.values(selected), [selected]);
  const totalLabels = useMemo(
    () => rows.reduce((n, r) => n + r.copies, 0),
    [rows]
  );
  const pages = Math.max(1, Math.ceil(totalLabels / LABELS_PER_PAGE));
  const overCap = totalLabels > MAX_LABELS;

  /* ── generate ── */
  const generate = async () => {
    if (rows.length === 0 || overCap) return;
    setGenerating(true);
    setError(null);
    try {
      const imageMap = {};
      await Promise.all(
        rows.map(async (u) => {
          try {
            const res = await bwipjs.toDataURL({
              bcid: 'code128',
              text: String(u.barcode),
              scale: 3,
              height: 12,
            });
            imageMap[u.unitId] = res.uri;
          } catch {
            imageMap[u.unitId] = null;
          }
        })
      );
      const html = buildHtml(rows, options, imageMap);
      const { uri } = await Print.printToFileAsync({ html });
      if (!mountedRef.current) return;
      setPdfUri(uri);
      toast(`PDF generated · ${totalLabels} label${totalLabels > 1 ? 's' : ''} · ${pages} page${pages > 1 ? 's' : ''}`);
      await sharePdf(uri);
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.message || 'Could not generate PDF');
        toast('PDF generation failed');
      }
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const sharePdf = async (uri) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save or print barcode labels',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF ready', `Saved at: ${uri}`);
    }
  };

  const startOver = () => {
    setSelected({});
    setPdfUri(null);
    setStep(0);
  };

  const onBack = () => {
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  /* ── step 1: pick ── */
  const renderProduct = ({ item: p }) => {
    const units = p.units || [];
    const ready = readyUnits(p);
    const selCount = ready.filter((u) => selected[u.id]).length;
    const all = ready.length > 0 && selCount === ready.length;
    const partial = selCount > 0 && !all;
    const multi = units.length > 1;
    const open = multi && (expanded[p.id] ?? true);
    const disabled = ready.length === 0;

    return (
      <View style={[styles.card, all && styles.cardSelected]}>
        <Pressable
          onPress={() => (disabled ? null : toggleProduct(p))}
          style={styles.productRow}
        >
          <View
            style={[
              styles.checkbox,
              (all || partial) && styles.checkboxOn,
              disabled && { opacity: 0.35 },
            ]}
          >
            {all ? (
              <Ionicons name="checkmark" size={14} color={c.textOnPrimary} />
            ) : partial ? (
              <Ionicons name="remove" size={14} color={c.textOnPrimary} />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, disabled && { color: c.textMuted }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {p.sku || 'no SKU'}
              {units.length > 0 ? ` · ${ready.length}/${units.length} with barcode` : ''}
            </Text>
          </View>
          {multi ? (
            <Pressable
              hitSlop={10}
              onPress={() => setExpanded((e) => ({ ...e, [p.id]: !open }))}
            >
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={c.textMuted}
              />
            </Pressable>
          ) : null}
        </Pressable>

        {multi && open
          ? units.map((u) => {
              const has = !!u.barcode;
              const on = !!selected[u.id];
              return (
                <Pressable
                  key={u.id}
                  onPress={() => (has ? toggleUnit(p, u) : null)}
                  style={styles.unitRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      styles.checkboxSm,
                      on && styles.checkboxOn,
                      !has && { opacity: 0.35 },
                    ]}
                  >
                    {on ? (
                      <Ionicons name="checkmark" size={12} color={c.textOnPrimary} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitName, !has && { color: c.textMuted }]} numberOfLines={1}>
                      {u.name}
                      {u.abbreviation ? ` · ${u.abbreviation}` : ''}
                      {u.price ? ` · ${u.price}` : ''}
                    </Text>
                  </View>
                  {has ? (
                    <Text style={styles.rowBarcode}>{u.barcode}</Text>
                  ) : (
                    <Text style={styles.noBarcode}>No barcode</Text>
                  )}
                </Pressable>
              );
            })
          : null}
      </View>
    );
  };

  const PickStep = (
    <View style={{ flex: 1 }}>
      <View style={styles.pad}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, SKU or barcode..."
            placeholderTextColor={c.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Text style={styles.actionCount}>{rows.length} unit{rows.length === 1 ? '' : 's'} selected</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={selectAllVisible} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Select all shown</Text>
            </Pressable>
            <Pressable onPress={clearAll} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Clear</Text>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.errText} numberOfLines={3}>{error}</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderProduct}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No products match.</Text>}
          ListFooterComponent={
            <Pressable
              onPress={() => navigation.navigate('BarcodeSearch')}
              style={styles.linkRow}
            >
              <Ionicons name="barcode-outline" size={16} color={c.link} />
              <Text style={styles.linkText}>
                Missing a barcode? Generate it in Product barcodes
              </Text>
            </Pressable>
          }
        />
      )}
    </View>
  );

  /* ── step 2: options + copies ── */
  const OptionsStep = (
    <ScrollView
      contentContainerStyle={[styles.pad, { paddingBottom: 120 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.label}>PRINT OPTIONS</Text>
      <View style={styles.optionsCard}>
        <OptionRow label="Product name" value={options.showName} c={c}
          onValueChange={(v) => setOptions((o) => ({ ...o, showName: v }))} />
        <OptionRow label="Unit label" value={options.showUnitLabel} c={c}
          onValueChange={(v) => setOptions((o) => ({ ...o, showUnitLabel: v }))} />
        <OptionRow label="Price" value={options.showPrice} c={c}
          onValueChange={(v) => setOptions((o) => ({ ...o, showPrice: v }))} />
        <OptionRow label="SKU" value={options.showSku} c={c} last
          onValueChange={(v) => setOptions((o) => ({ ...o, showSku: v }))} />
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>COPIES PER LABEL</Text>
      <View style={{ gap: 6 }}>
        {rows.map((r) => (
          <View key={r.unitId} style={styles.copyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{r.productName}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {r.unitName}{r.unitAbbr ? ` · ${r.unitAbbr}` : ''}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => setCopies(r.unitId, -1)} style={styles.stepBtn} hitSlop={6}>
                <Ionicons name="remove" size={16} color={c.textPrimary} />
              </Pressable>
              <Text style={styles.stepVal}>{r.copies}</Text>
              <Pressable onPress={() => setCopies(r.unitId, 1)} style={styles.stepBtn} hitSlop={6}>
                <Ionicons name="add" size={16} color={c.textPrimary} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  /* ── step 3: generate ── */
  const spare = pages * LABELS_PER_PAGE - totalLabels;
  const GenerateStep = (
    <ScrollView
      contentContainerStyle={[styles.pad, { paddingBottom: 120 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryBig}>{totalLabels}</Text>
        <Text style={styles.summaryLabel}>labels · {pages} A4 page{pages > 1 ? 's' : ''}</Text>
        <View style={styles.rule} />
        <SummaryLine k="Units" v={String(rows.length)} c={c} />
        <SummaryLine
          k="Prints"
          v={[
            options.showName && 'Name',
            options.showUnitLabel && 'Unit',
            options.showPrice && 'Price',
            options.showSku && 'SKU',
          ].filter(Boolean).join(' · ') || 'Barcode only'}
          c={c}
        />
        <SummaryLine k="Empty slots on last page" v={String(spare)} c={c} />
        {activeBranch?.name ? <SummaryLine k="Branch" v={activeBranch.name} c={c} /> : null}
      </View>

      {overCap ? (
        <View style={styles.errBox}>
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={styles.errText}>
            Max {MAX_LABELS} labels per PDF. Reduce copies or split into batches.
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errBox}>
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={styles.errText} numberOfLines={3}>{error}</Text>
        </View>
      ) : null}

      {pdfUri ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => sharePdf(pdfUri)} style={styles.secondaryBtn}>
            <Ionicons name="share-outline" size={16} color={c.link} />
            <Text style={styles.secondaryBtnText}>Share PDF again</Text>
          </Pressable>
          <Pressable onPress={startOver} style={styles.secondaryBtn}>
            <Ionicons name="refresh-outline" size={16} color={c.link} />
            <Text style={styles.secondaryBtnText}>New batch</Text>
          </Pressable>
        </View>
      ) : null}
      <Text style={styles.footHint}>A4 · 3 × 8 grid · 24 labels per page</Text>
    </ScrollView>
  );

  /* ── footer CTA per step ── */
  const cta =
    step === 0
      ? { text: `Next · ${rows.length} selected`, disabled: rows.length === 0, onPress: () => setStep(1) }
      : step === 1
      ? { text: `Next · ${totalLabels} labels`, disabled: rows.length === 0, onPress: () => setStep(2) }
      : {
          text: pdfUri ? 'Regenerate PDF' : 'Generate PDF',
          disabled: generating || rows.length === 0 || overCap,
          onPress: generate,
          icon: 'document-text-outline',
        };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>LABELS</Text>
          <Text style={styles.title}>Barcode labels</Text>
        </View>
        {activeBranch?.name ? (
          <View style={styles.branchChip}>
            <Ionicons name="business-outline" size={12} color={c.primary} />
            <Text style={styles.branchText} numberOfLines={1}>{activeBranch.name}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.stepper3}>
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={c.textOnPrimary} />
                ) : (
                  <Text style={[styles.stepNum, active && { color: c.textOnPrimary }]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && { color: c.textPrimary }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {step === 0 ? PickStep : step === 1 ? OptionsStep : GenerateStep}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={cta.onPress}
          disabled={cta.disabled}
          style={[styles.primaryBtn, cta.disabled && { opacity: 0.5 }]}
        >
          {generating ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <>
              {cta.icon ? <Ionicons name={cta.icon} size={18} color={c.textOnPrimary} /> : null}
              <Text style={styles.primaryBtnText}>{cta.text}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function OptionRow({ label, value, onValueChange, c, last }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SummaryLine({ k, v, c }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 12 }}>
      <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>{k}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    pad: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
    list: { paddingHorizontal: spacing.xl },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    headerIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },
    kicker: { color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
    title: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    branchChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 130,
      paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: c.primarySoft,
    },
    branchText: { color: c.primary, fontSize: 11, fontWeight: '800', flexShrink: 1 },

    stepper3: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    },
    stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepDot: {
      width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border,
    },
    stepDotOn: { backgroundColor: c.primary, borderColor: c.primary },
    stepNum: { color: c.textMuted, fontSize: 11, fontWeight: '900' },
    stepLabel: { color: c.textMuted, fontSize: 12, fontWeight: '800' },

    label: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },

    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface,
      borderRadius: 12, paddingHorizontal: 14, minHeight: 44, marginBottom: 10,
    },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 15, paddingVertical: 10 },

    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    actionCount: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.primarySoft },
    smallBtnText: { color: c.primary, fontSize: 12, fontWeight: '800' },

    loading: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },

    card: {
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    cardSelected: { borderColor: c.primary },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12 },
    unitRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingLeft: 24, paddingRight: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
      backgroundColor: c.background,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
    },
    checkboxSm: { width: 18, height: 18, borderRadius: 5 },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    rowTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    rowMeta: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    unitName: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
    rowBarcode: { color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    noBarcode: { color: c.textMuted, fontSize: 11, fontWeight: '700' },

    linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18 },
    linkText: { color: c.link, fontSize: 13, fontWeight: '700' },

    optionsCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: radius.lg, paddingHorizontal: spacing.lg,
    },
    copyRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stepBtn: {
      width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
    },
    stepVal: { minWidth: 28, textAlign: 'center', color: c.textPrimary, fontWeight: '900', fontSize: 14 },

    summaryCard: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: radius.xl, padding: spacing.lg, alignItems: 'stretch',
    },
    summaryBig: { color: c.textPrimary, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center' },
    summaryLabel: { color: c.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 14 },

    secondaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    secondaryBtnText: { color: c.link, fontSize: 14, fontWeight: '800' },

    footer: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingHorizontal: spacing.xl, paddingTop: 12,
      backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    primaryBtn: {
      minHeight: 50, borderRadius: 14, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    },
    primaryBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '800' },
    footHint: { color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12 },

    errBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.dangerSoft,
      borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
    },
    errText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },
  });