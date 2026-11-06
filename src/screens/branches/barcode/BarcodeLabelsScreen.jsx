// src/screens/branches/barcode/BarcodeLabelsScreen.jsx
//
// Barcode labels: pick units (each has its own barcode), choose which fields
// to print, then generate an A4 PDF (3 × 8 = 24 labels per page).
// Flow: bwip-js → HTML → expo-print → save to cache → share sheet.
// Shows a toast after the PDF is generated.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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

/* Tiny toast helper — Android native toast, Alert fallback on iOS */
function toast(msg) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('', msg);
  }
}

/* Build the HTML page for expo-print.
   imageMap: { [unitId]: dataUrl }  */
function buildHtml(rows, options, imageMap) {
  const cells = rows
    .map((r) => {
      const img = imageMap[r.unitId];
      const lines = [];
      if (options.showName && r.productName) {
        lines.push(`<div class="name">${escapeHtml(r.productName)}</div>`);
      }
      if (options.showUnitLabel && r.unitName) {
        lines.push(
          `<div class="unit">${escapeHtml(r.unitName)}${
            r.unitAbbr ? ` · ${escapeHtml(r.unitAbbr)}` : ''
          }</div>`
        );
      }
      if (options.showPrice && r.price) {
        lines.push(`<div class="price">${escapeHtml(r.price)}</div>`);
      }
      if (options.showSku && r.sku) {
        lines.push(`<div class="sku">${escapeHtml(r.sku)}</div>`);
      }
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
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 38.1mm;
    gap: 2mm;
  }
  .label {
    border: 0.3mm dashed #d4d4d8;
    padding: 1.5mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .bc { width: 100%; max-height: 20mm; object-fit: contain; }
  .bc.missing { font-size: 8px; color: #b91c1c; text-align: center; }
  .name { font-size: 9px; font-weight: 700; margin-top: 1mm; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .unit { font-size: 8px; color: #52525b; margin-top: 0.5mm; text-align: center; }
  .price { font-size: 9px; font-weight: 800; margin-top: 0.5mm; }
  .sku { font-size: 7px; color: #71717a; margin-top: 0.5mm; }
</style>
</head>
<body>
  <div class="grid">${cells}</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function BarcodeLabelsScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();

  const [query, setQuery] = useState('');
  const [units, setUnits] = useState([]); // flattened: one entry per unit with barcode
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({}); // { [unitId]: true }
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [options, setOptions] = useState({
    showName: true,
    showPrice: true,
    showUnitLabel: true,
    showSku: false,
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (searchText) => {
      if (!activeOrganization?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await inventoryService.getProducts(activeOrganization.id, {
          search: searchText || undefined,
          limit: 50,
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        const flat = [];
        items.forEach((p) => {
          (p.units || []).forEach((u) => {
            if (u.barcode) {
              flat.push({
                unitId: u.id,
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                price: u.price,
                unitName: u.name,
                unitAbbr: u.abbreviation,
                barcode: u.barcode,
              });
            }
          });
        });
        if (mountedRef.current) setUnits(flat);
      } catch (e) {
        if (mountedRef.current) {
          setError(e?.response?.data?.message || 'Could not load products');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [activeOrganization?.id]
  );

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id]);

  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleUnit = (id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const selectAll = () => {
    const next = {};
    units.forEach((u) => {
      next[u.unitId] = true;
    });
    setSelected(next);
  };

  const clearAll = () => setSelected({});

  const selectedUnits = useMemo(
    () => units.filter((u) => selected[u.unitId]),
    [units, selected]
  );

  const generate = async () => {
    if (selectedUnits.length === 0) {
      toast('Pick at least one unit');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      // 1. Render all barcode images in parallel
      const imageMap = {};
      await Promise.all(
        selectedUnits.map(async (u) => {
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

      // 2. Build HTML and generate PDF
      const html = buildHtml(selectedUnits, options, imageMap);
      const { uri } = await Print.printToFileAsync({ html });

      // 3. Toast first (non-blocking feedback)
      const pages = Math.ceil(selectedUnits.length / LABELS_PER_PAGE);
      toast(`PDF generated · ${selectedUnits.length} label${
        selectedUnits.length > 1 ? 's' : ''
      } · ${pages} page${pages > 1 ? 's' : ''}`);

      // 4. Open share sheet (Save to Files / WhatsApp / Print)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or print barcode labels',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF ready', `Saved at: ${uri}`);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.message || 'Could not generate PDF');
        toast('PDF generation failed');
      }
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 32 + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
          <View pointerEvents="none" style={styles.headerGlow} />
          <View style={styles.headerTop}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.headerIcon}
            >
              <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
            </Pressable>
            <View style={styles.statusChip}>
              <Ionicons name="print-outline" size={12} color={c.primary} />
              <Text style={styles.statusText}>LABELS</Text>
            </View>
          </View>
          <Text style={styles.headerName}>Barcode labels</Text>
          <Text style={styles.headerSub}>
            Pick units, choose what to print, then generate an A4 PDF.
          </Text>
        </View>

        <View style={styles.body}>
          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={c.danger} />
              <Text style={styles.errText} numberOfLines={3}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Search */}
          <Text style={styles.label}>Find unit</Text>
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

          {/* Select all / clear */}
          <View style={styles.actionRow}>
            <Text style={styles.actionCount}>
              {selectedCount} selected · {units.length} available
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={selectAll} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Select all</Text>
              </Pressable>
              <Pressable onPress={clearAll} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Clear</Text>
              </Pressable>
            </View>
          </View>

          {/* Units list */}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : units.length === 0 ? (
            <Text style={styles.emptyText}>
              No units with barcodes match. Generate barcodes first.
            </Text>
          ) : (
            <View style={{ gap: 6 }}>
              {units.map((u) => {
                const isSel = !!selected[u.unitId];
                return (
                  <Pressable
                    key={u.unitId}
                    onPress={() => toggleUnit(u.unitId)}
                    style={[styles.row, isSel && styles.rowSelected]}
                  >
                    <View
                      style={[styles.checkbox, isSel && styles.checkboxOn]}
                    >
                      {isSel ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={c.textOnPrimary}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {u.productName}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {u.unitName}
                        {u.unitAbbr ? ` · ${u.unitAbbr}` : ''}
                        {u.price ? ` · ${u.price}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.rowBarcode}>{u.barcode}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Options */}
          <Text style={[styles.label, { marginTop: 20 }]}>Print options</Text>
          <View style={styles.optionsCard}>
            <OptionRow
              label="Product name"
              value={options.showName}
              onValueChange={(v) => setOptions((o) => ({ ...o, showName: v }))}
              c={c}
            />
            <OptionRow
              label="Unit label"
              value={options.showUnitLabel}
              onValueChange={(v) =>
                setOptions((o) => ({ ...o, showUnitLabel: v }))
              }
              c={c}
            />
            <OptionRow
              label="Price"
              value={options.showPrice}
              onValueChange={(v) => setOptions((o) => ({ ...o, showPrice: v }))}
              c={c}
            />
            <OptionRow
              label="SKU"
              value={options.showSku}
              onValueChange={(v) => setOptions((o) => ({ ...o, showSku: v }))}
              c={c}
              last
            />
          </View>

          {/* Generate button */}
          <Pressable
            onPress={generate}
            disabled={generating || selectedCount === 0}
            style={[
              styles.primaryBtn,
              { marginTop: 20 },
              (generating || selectedCount === 0) && { opacity: 0.6 },
            ]}
          >
            {generating ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={c.textOnPrimary}
                />
                <Text style={styles.primaryBtnText}>
                  Generate PDF ({selectedCount})
                </Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footHint}>
            A4 · 3 × 8 grid · up to 24 labels per page
          </Text>
        </View>
      </ScrollView>
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
      <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

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
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: c.primarySoft,
    },
    statusText: {
      color: c.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
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

    label: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 6,
    },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 44,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 15,
      paddingVertical: 10,
    },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    actionCount: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    smallBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: c.primarySoft,
    },
    smallBtnText: { color: c.primary, fontSize: 12, fontWeight: '800' },

    loading: { paddingVertical: 24, alignItems: 'center' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 16,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
    rowTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    rowMeta: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    rowBarcode: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },

    optionsCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
    },

    primaryBtn: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '800' },
    footHint: {
      color: c.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 8,
    },

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
  });