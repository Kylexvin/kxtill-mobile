// src/screens/branches/barcode/BarcodeGenerateScreen.jsx
//
// Pick product → pick unit → Generate → display barcode bars.
// Saves the barcode org-wide via POST /products/:id/units/:unitId/barcode.
// Deterministic — regenerating on the same unit returns the same barcode.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Share,
  FlatList,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@react-native-vector-icons/ionicons';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import inventoryService from '../../../services/inventory.service';


/* ── Code 128B encoder (minimal, digits + uppercase + a few symbols) ──
   Enough for numeric and alphanumeric barcodes. Not a full Code128
   implementation, but the codes we generate are digits only (13 chars),
   which Code128B handles cleanly.
*/
const CODE128_PATTERNS = [
  // Values 0–106 in binary (bar/space widths). Source: standard Code128 table.
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','1100011101011',
];

const START_B = 104;
const STOP = 106;

function encodeCode128B(text) {
  const values = [START_B];
  let checksum = START_B;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    values.push(code);
    checksum += code * (i + 1);
  }
  values.push(checksum % 103);
  values.push(STOP);
  return values.map((v) => CODE128_PATTERNS[v]).join('');
}

function BarcodeBars({ value, width = 300, height = 80, color = '#000', background = '#FFF' }) {
  const bits = useMemo(() => encodeCode128B(value), [value]);
  const moduleWidth = width / bits.length;
  const bars = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let run = 1;
      while (bits[i + run] === '1') run++;
      bars.push({ x: i * moduleWidth, w: run * moduleWidth });
      i += run;
    } else {
      i++;
    }
  }
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill={background} />
      {bars.map((b, idx) => (
        <Rect key={idx} x={b.x} y={0} width={b.w} height={height} fill={color} />
      ))}
    </Svg>
  );
}

/* ── Screen ─────────────────────────────────────────────────── */

export default function BarcodeGenerateScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!activeOrganization?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getProducts(activeOrganization.id, {
        search: query || undefined,
        limit: 30,
      });
      if (mountedRef.current) {
        setProducts(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.response?.data?.message || 'Could not load products');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeOrganization?.id, query]);

  useEffect(() => {
    load();
  }, [load]);

  const pickProduct = async (p) => {
    setSelectedProduct(p);
    setSelectedUnit(p.baseUnit || (p.units && p.units[0]) || null);
    setResult(null);
    setError(null);
  };

  const generate = async () => {
    if (!selectedProduct || !selectedUnit) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await inventoryService.generateBarcode(
        activeOrganization.id,
        selectedProduct.id,
        selectedUnit.id
      );
      if (mountedRef.current) {
        setResult(data?.unit || null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e?.response?.data?.message || e?.message || 'Generate failed');
      }
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const copyBarcode = async () => {
    if (!result?.barcode) return;
    await Clipboard.setStringAsync(result.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareBarcode = async () => {
    if (!result?.barcode) return;
    await Share.share({ message: `${selectedProduct?.name}: ${result.barcode}` });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
          <View pointerEvents="none" style={styles.headerGlow} />
          <View style={styles.headerTop}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerIcon}>
              <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
            </Pressable>
            <View style={styles.statusChip}>
              <Ionicons name="barcode-outline" size={12} color={c.primary} />
              <Text style={styles.statusText}>GENERATE</Text>
            </View>
          </View>
          <Text style={styles.headerName}>Generate barcode</Text>
          <Text style={styles.headerSub}>
            Pick a product and unit, then generate a barcode.
          </Text>
        </View>

        <View style={styles.body}>
          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={c.danger} />
              <Text style={styles.errText} numberOfLines={3}>{error}</Text>
            </View>
          ) : null}

          {/* Product search */}
          <Text style={styles.label}>Find product</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={c.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={load}
              placeholder="Search products..."
              placeholderTextColor={c.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : selectedProduct ? (
            <View style={styles.selectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName} numberOfLines={1}>{selectedProduct.name}</Text>
                <Text style={styles.selectedMeta} numberOfLines={1}>
                  {selectedProduct.category || '—'} · {selectedProduct.sku || 'no SKU'}
                </Text>
              </View>
              <Pressable onPress={() => { setSelectedProduct(null); setSelectedUnit(null); setResult(null); }} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={c.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>No products match.</Text>
              ) : products.slice(0, 6).map((p) => (
                <Pressable key={p.id} onPress={() => pickProduct(p)} style={styles.productRow}>
                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Unit picker */}
          {selectedProduct ? (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Unit</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(selectedProduct.units || []).map((u) => {
                  const active = selectedUnit?.id === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => { setSelectedUnit(u); setResult(null); }}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {u.name} · {u.abbreviation}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={generate}
                disabled={!selectedUnit || generating}
                style={[styles.primaryBtn, { marginTop: 20 }, (!selectedUnit || generating) && { opacity: 0.6 }]}
              >
                {generating ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Generate barcode</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {/* Result */}
          {result?.barcode ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>BARCODE</Text>
              <View style={styles.barcodeWrap}>
                <BarcodeBars value={result.barcode} width={300} height={80} />
              </View>
              <Text style={styles.resultNumber}>{result.barcode}</Text>

              <View style={styles.resultActions}>
                <Pressable onPress={copyBarcode} style={styles.actionBtn}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={c.primary} />
                  <Text style={styles.actionText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
                <Pressable onPress={shareBarcode} style={styles.actionBtn}>
                  <Ionicons name="share-outline" size={16} color={c.primary} />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
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
    position: 'absolute', top: -100, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: c.primary, opacity: 0.08,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: c.primarySoft },
  statusText: { color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  headerName: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginTop: 3 },

  label: { color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 44,
  },
  searchInput: { flex: 1, color: c.textPrimary, fontSize: 15, paddingVertical: 10 },

  loading: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: c.surface, borderRadius: 12,
  },
  productName: { flex: 1, color: c.textPrimary, fontSize: 15, fontWeight: '600' },

  selectedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, backgroundColor: c.primarySoft, borderRadius: 12, marginTop: 4,
  },
  selectedName: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
  selectedMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  pillActive: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: c.textOnPrimary },

  primaryBtn: { minHeight: 50, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '800' },

  resultCard: {
    marginTop: 20, padding: 16,
    backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border,
  },
  resultLabel: { color: c.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  barcodeWrap: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingVertical: 8 },
  resultNumber: { color: c.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 10, fontVariant: ['tabular-nums'] },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: c.primarySoft },
  actionText: { color: c.primary, fontSize: 13, fontWeight: '800' },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },
});