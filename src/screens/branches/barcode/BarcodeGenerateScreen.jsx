// src/screens/branches/barcode/BarcodeSearchScreen.jsx
//
// Search products by name or SKU, tap to open the barcode modal.
// Row summary shows "N/M with barcode" so users can spot gaps without
// opening each product.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import inventoryService from '../../../services/inventory.service';
import BarcodeModal from './BarcodeModal';

function unitSummary(product) {
  const units = product.units || [];
  const total = units.length;
  const withBarcode = units.filter((u) => !!u.barcode).length;
  return { total, withBarcode };
}

export default function BarcodeSearchScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

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

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id]);

  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onUpdated = (updatedUnit) => {
    // Update the product in the list so the summary "N/M with barcode" is
    // correct after a generation.
    setProducts((prev) =>
      prev.map((p) => {
        if (!selected || p.id !== selected.id) return p;
        const units = (p.units || []).map((u) =>
          u.id === updatedUnit.id ? { ...u, ...updatedUnit } : u
        );
        return { ...p, units };
      })
    );
    setSelected((prev) => {
      if (!prev) return prev;
      const units = (prev.units || []).map((u) =>
        u.id === updatedUnit.id ? { ...u, ...updatedUnit } : u
      );
      return { ...prev, units };
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.headerIcon}
        >
          <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>BARCODE</Text>
          <Text style={styles.title}>Product barcodes</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name or SKU"
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

      {error ? (
        <View style={styles.errBox}>
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No products match.</Text>
          }
          renderItem={({ item }) => {
            const { total, withBarcode } = unitSummary(item);
            const done = total > 0 && withBarcode === total;
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.sku || 'no SKU'}
                    {total > 0 ? ` · ${total} unit${total === 1 ? '' : 's'}` : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor: done ? c.primarySoft : c.surfaceElevated,
                      borderColor: done ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: done ? c.primary : c.textMuted },
                    ]}
                  >
                    {total === 0 ? '—' : `${withBarcode}/${total}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            );
          }}
        />
      )}

      <BarcodeModal
        visible={!!selected}
        product={selected}
        onClose={() => setSelected(null)}
        onUpdated={onUpdated}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kicker: {
      ...typography.label,
      color: c.primary,
      letterSpacing: 1.6,
      marginBottom: 2,
    },
    title: { ...typography.h2, color: c.textPrimary, letterSpacing: -0.4 },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 44,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 15,
      paddingVertical: 10,
    },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: 8 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    rowName: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    rowMeta: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 40,
      alignItems: 'center',
    },
    pillText: { fontSize: 11, fontWeight: '800' },

    loading: { paddingVertical: 40, alignItems: 'center' },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
    },

    errBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    errText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },
  });