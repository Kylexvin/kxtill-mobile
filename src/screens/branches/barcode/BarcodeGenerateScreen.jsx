// src/screens/branches/barcode/BarcodeGenerateScreen.jsx
//
// Generate a barcode for a product unit.
// - Fetches products for the org, searchable by name / SKU / barcode.
// - If the selected unit already has a barcode, show it immediately.
// - Otherwise call POST /products/:id/units/:unitId/barcode (idempotent).
// Barcodes are saved org-wide — no copy / share here on purpose.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import bwipjs from '@bwip-js/react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import inventoryService from '../../../services/inventory.service';

/* ── Barcode render (pure JS → PNG data URL, no react-native-svg) ── */
function BarcodeImage({ value }) {
  const [uri, setUri] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    if (!value) return;
    bwipjs
      .toDataURL({ bcid: 'code128', text: String(value), scale: 3, height: 12 })
      .then((r) => {
        if (!cancelled) setUri(r.uri);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <View style={{ width: 300, height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#B91C1C', fontSize: 12 }}>Could not render barcode</Text>
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={{ width: 300, height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#0F766E" />
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: 300, height: 80 }} resizeMode="contain" />;
}

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
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Clear selection only — keep query + list ── */
  const clearSelection = useCallback(() => {
    setSelectedProduct(null);
    setSelectedUnit(null);
    setError(null);
  }, []);

  /* ── On leaving the screen: drop selection, keep search text ── */
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedProduct(null);
        setSelectedUnit(null);
        setError(null);
      };
    }, [])
  );

  /* ── Load products (debounced on query) ── */
  const load = useCallback(
    async (searchText) => {
      if (!activeOrganization?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await inventoryService.getProducts(activeOrganization.id, {
          search: searchText || undefined,
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
    },
    [activeOrganization?.id]
  );

  // Initial fetch
  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      load(query.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ── Selection ── */
  const pickProduct = (p) => {
    setSelectedProduct(p);
    const unit =
      (p.units || []).find((u) => u.id === p.baseUnitId) ||
      (p.units && p.units[0]) ||
      null;
    setSelectedUnit(unit);
    setError(null);
  };

  const pickUnit = (u) => {
    setSelectedUnit(u);
    setError(null);
  };

  /* ── Generate (only when unit.barcode is null) ── */
  const generate = async () => {
    if (!selectedProduct || !selectedUnit) return;
    if (selectedUnit.barcode) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await inventoryService.generateBarcode(
        activeOrganization.id,
        selectedProduct.id,
        selectedUnit.id
      );
      const updated = data?.unit || null;
      if (mountedRef.current && updated) {
        setSelectedUnit(updated);
        setSelectedProduct((prev) => {
          if (!prev) return prev;
          const units = (prev.units || []).map((u) =>
            u.id === updated.id ? { ...u, ...updated } : u
          );
          return { ...prev, units };
        });
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e?.response?.data?.message || e?.message || 'Could not generate barcode'
        );
      }
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const barcode = selectedUnit?.barcode || null;
  const canGenerate = !!selectedProduct && !!selectedUnit && !barcode;

  /* ── UI ── */
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
              onPress={() => (selectedProduct ? clearSelection() : navigation.goBack())}
              hitSlop={10}
              style={styles.headerIcon}
            >
              <Ionicons
                name={selectedProduct ? 'close' : 'arrow-back'}
                size={18}
                color={c.textPrimary}
              />
            </Pressable>
            <View style={styles.statusChip}>
              <Ionicons name="barcode-outline" size={12} color={c.primary} />
              <Text style={styles.statusText}>BARCODE</Text>
            </View>
          </View>
          <Text style={styles.headerName}>Product barcode</Text>
          <Text style={styles.headerSub}>
            Search by name, SKU, or barcode. Pick a unit to view or generate its barcode.
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
          <Text style={styles.label}>Find product</Text>
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

          {/* Product list / selected */}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : selectedProduct ? (
            <View style={styles.selectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName} numberOfLines={1}>
                  {selectedProduct.name}
                </Text>
                <Text style={styles.selectedMeta} numberOfLines={1}>
                  {selectedProduct.sku || 'no SKU'}
                  {selectedProduct.category ? ` · ${selectedProduct.category}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {products.length === 0 ? (
                <Text style={styles.emptyText}>No products match.</Text>
              ) : (
                products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => pickProduct(p)}
                    style={styles.productRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.productMeta} numberOfLines={1}>
                        {p.sku || 'no SKU'}
                        {p.category ? ` · ${p.category}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={c.textMuted}
                    />
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Unit picker */}
          {selectedProduct ? (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Unit</Text>
              {selectedProduct.units && selectedProduct.units.length > 0 ? (
                <View style={styles.unitWrap}>
                  {selectedProduct.units.map((u) => {
                    const active = selectedUnit?.id === u.id;
                    const has = !!u.barcode;
                    return (
                      <Pressable
                        key={u.id}
                        onPress={() => pickUnit(u)}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        {has ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color={active ? c.textOnPrimary : c.primary}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.pillText,
                            active && styles.pillTextActive,
                          ]}
                        >
                          {u.name} · {u.abbreviation}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  This product has no units.
                </Text>
              )}

              {canGenerate ? (
                <Pressable
                  onPress={generate}
                  disabled={generating}
                  style={[
                    styles.primaryBtn,
                    { marginTop: 20 },
                    generating && { opacity: 0.6 },
                  ]}
                >
                  {generating ? (
                    <ActivityIndicator color={c.textOnPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Generate barcode</Text>
                  )}
                </Pressable>
              ) : null}
            </>
          ) : null}

          {/* Barcode result */}
          {selectedUnit && barcode ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                BARCODE · {selectedUnit.name.toUpperCase()}
              </Text>
              <View style={styles.barcodeWrap}>
                <BarcodeImage value={barcode} />
              </View>
              <Text style={styles.resultNumber}>{barcode}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
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

    loading: { paddingVertical: 24, alignItems: 'center' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 16,
    },

    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      borderRadius: 12,
    },
    productName: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    productMeta: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },

    selectedBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
    },
    selectedName: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    selectedMeta: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },

    unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    pillActive: { backgroundColor: c.primary, borderColor: c.primary },
    pillText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    pillTextActive: { color: c.textOnPrimary },

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

    resultCard: {
      marginTop: 20,
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    resultLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 10,
    },
    barcodeWrap: {
      alignItems: 'center',
      backgroundColor: '#FFF',
      borderRadius: 8,
      paddingVertical: 8,
    },
    resultNumber: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 1.5,
      textAlign: 'center',
      marginTop: 10,
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
    errText: {
      flex: 1,
      color: c.danger,
      fontSize: 13,
      fontWeight: '600',
    },
  });