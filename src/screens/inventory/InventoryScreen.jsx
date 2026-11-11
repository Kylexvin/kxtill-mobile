// src/screens/inventory/InventoryScreen.jsx
//
// v3 — rewrite.
//   - Single filter object → atomic param changes → single load path
//   - Header memoized; search owns its own state (no focus loss)
//   - FilterSheet receives everything it needs (fixes counts crash)
//   - No double safe-area inset
//   - Back falls back to BranchHome when nothing to pop
//   - loadMore guarded against filter-token changes
//   - Skeleton mirrors real header 1:1 (no overlaps)
//   - Rows have breathing room under the header
//   - Pagination, caching, permissions, contexts unchanged

import {
  memo,
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
  FlatList,
  RefreshControl,
  Pressable,
  Animated,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissionsContext } from '../../context/PermissionsContext';
import { useSettings } from '../../context/SettingsContext';
import { KXTILL } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';
import { api } from '../../services/api';
import { readRow, writeRow } from '../../cache/db';

/* ── cache ─────────────────────────────────────────────────────── */

const cacheKey = (orgId) => `inventory:v3:${orgId}`;

async function readCache(orgId) {
  if (!orgId) return null;
  const row = await readRow('settings_cache', { org_id: cacheKey(orgId) });
  if (!row) return null;
  try {
    return { payload: JSON.parse(row.payload), updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

async function writeCache(orgId, payload) {
  if (!orgId || !payload) return;
  await writeRow('settings_cache', {
    org_id: cacheKey(orgId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

/* ── constants ─────────────────────────────────────────────────── */

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { id: 'all', label: 'All', icon: 'list-outline' },
  { id: 'in-stock', label: 'In', icon: 'checkmark-circle-outline' },
  { id: 'low-stock', label: 'Low', icon: 'warning-outline' },
  { id: 'out-of-stock', label: 'Out', icon: 'alert-circle-outline' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'retail', label: 'Retail' },
];

const DEFAULT_FILTERS = {
  search: '',
  status: 'all',
  category: 'all',
  type: 'all',
  showArchived: false,
};

/* ── skeleton ──────────────────────────────────────────────────── */

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

function InventorySkeleton({ styles, insets }) {
  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.skeletonHeaderWrap}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Sk width={36} height={36} r={18} />
            <Sk width={80} height={24} r={12} />
          </View>
          <Sk width="55%" height={22} r={8} style={{ marginTop: 12 }} />
          <Sk width="40%" height={13} r={6} style={{ marginTop: 6 }} />

          <View style={styles.chipRow}>
            <View style={styles.statChip}>
              <Sk width="70%" height={14} r={6} />
            </View>
            <View style={styles.statChip}>
              <Sk width="70%" height={14} r={6} />
            </View>
            <View style={styles.statChip}>
              <Sk width="70%" height={14} r={6} />
            </View>
          </View>

          <View style={styles.headerRule} />

          <Sk width="100%" height={40} r={12} />

          <View style={[styles.filterRow, { marginTop: 10 }]}>
            {[0, 1, 2, 3].map((i) => (
              <Sk key={i} width="23%" height={36} r={12} />
            ))}
          </View>

          <Sk width="100%" height={34} r={12} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.body}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skeletonRowWrap}>
            <View style={styles.itemCard}>
              <Sk width={34} height={34} r={10} />
              <View style={{ flex: 1, gap: 6 }}>
                <Sk width="60%" height={14} r={6} />
                <Sk width="35%" height={11} r={5} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Sk width={44} height={13} r={5} />
                <Sk width={52} height={10} r={4} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── header (memoized; owns search input state) ────────────────── */

const Header = memo(function Header({
  c,
  styles,
  orgName,
  counts,
  status,
  onChangeStatus,
  onOpenFilters,
  activeFilterCount,
  onBack,
  canCreate,
  onCreate,
  onCommitSearch,
}) {
  const [search, setSearch] = useState('');

  const inStock = counts?.inStock ?? 0;
  const low = counts?.lowStock ?? 0;
  const out = counts?.outOfStock ?? 0;

  const clearSearch = () => {
    setSearch('');
    onCommitSearch('');
  };

  return (
    <View style={styles.headerCard}>
      <View pointerEvents="none" style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={onBack} hitSlop={10} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </Pressable>
          <View style={styles.monogramSmall}>
            <Ionicons name="cube" size={16} color={c.textOnPrimary} />
          </View>
        </View>
        {canCreate ? (
          <Pressable
            onPress={onCreate}
            style={[styles.statusChip, { backgroundColor: c.primarySoft }]}
          >
            <Ionicons name="add" size={12} color={c.primary} />
            <Text style={[styles.statusText, { color: c.primary }]}>Add</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.headerName} numberOfLines={1}>
        Inventory
      </Text>
      <Text style={styles.headerSub} numberOfLines={1}>
        {orgName || 'Business'}
      </Text>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons name="checkmark-circle" size={13} color={c.success} />
          <Text style={styles.statChipValue}>{inStock}</Text>
          <Text style={styles.statChipLabel}>in</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="warning" size={13} color={c.warning} />
          <Text style={[styles.statChipValue, { color: c.warning }]}>
            {low}
          </Text>
          <Text style={styles.statChipLabel}>low</Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="alert-circle" size={13} color={c.danger} />
          <Text style={[styles.statChipValue, { color: c.danger }]}>
            {out}
          </Text>
          <Text style={styles.statChipLabel}>out</Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={14} color={c.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => onCommitSearch(search)}
          onBlur={() => onCommitSearch(search)}
          placeholder="Search name, SKU…"
          placeholderTextColor={c.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <Pressable onPress={clearSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = status === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => onChangeStatus(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? c.textOnPrimary : c.textSecondary}
              />
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onOpenFilters} style={styles.filterSheetBtn}>
        <Ionicons name="options-outline" size={14} color={c.link} />
        <Text style={styles.filterSheetText}>
          More filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Text>
      </Pressable>
    </View>
  );
});

/* ── filter sheet ──────────────────────────────────────────────── */

const FilterSheet = memo(function FilterSheet({
  c,
  styles,
  visible,
  onClose,
  counts,
  categories,
  filters,
  setFilters,
  isPharmacyOrg,
  onClear,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={c.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.sheetLabel}>CATEGORY</Text>
          <FlatList
            horizontal
            data={['all', ...categories]}
            keyExtractor={(x) => x}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 14 }}
            renderItem={({ item: cat }) => {
              const active = filters.category === cat;
              const count =
                cat === 'all' ? null : counts?.byCategory?.[cat] ?? null;
              return (
                <Pressable
                  onPress={() =>
                    setFilters((f) => ({ ...f, category: cat }))
                  }
                  style={[
                    styles.filterPill,
                    active && styles.filterPillActive,
                    { flex: 0, paddingHorizontal: 12 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {cat === 'all' ? 'All' : cat}
                    {count != null ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            }}
          />

          {isPharmacyOrg ? (
            <>
              <Text style={styles.sheetLabel}>TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {TYPE_FILTERS.map((t) => {
                  const active = filters.type === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() =>
                        setFilters((f) => ({ ...f, type: t.id }))
                      }
                      style={[
                        styles.filterPill,
                        active && styles.filterPillActive,
                        { flex: 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          active && styles.filterTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={() =>
              setFilters((f) => ({ ...f, showArchived: !f.showArchived }))
            }
            style={styles.sheetToggle}
          >
            <Text
              style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}
            >
              Show archived
            </Text>
            <Ionicons
              name={filters.showArchived ? 'checkbox' : 'square-outline'}
              size={20}
              color={filters.showArchived ? c.primary : c.textMuted}
            />
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={() => {
                onClear();
                onClose();
              }}
              style={[
                styles.sheetBtn,
                {
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.surface,
                },
              ]}
            >
              <Text style={{ color: c.textSecondary, fontWeight: '800' }}>
                Clear
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={[styles.sheetBtn, { backgroundColor: c.primary }]}
            >
              <Text style={{ color: c.textOnPrimary, fontWeight: '800' }}>
                Done
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

/* ── row ───────────────────────────────────────────────────────── */

const Row = memo(function Row({ p, styles, c, formatCurrency, onPress }) {
  const toneColor =
    p.stockStatus === 'out-of-stock'
      ? c.danger
      : p.stockStatus === 'low-stock'
        ? c.warning
        : p.stockStatus === 'in-stock'
          ? c.success
          : c.textMuted;
  const toneIcon =
    p.stockStatus === 'out-of-stock'
      ? 'alert-circle'
      : p.stockStatus === 'low-stock'
        ? 'warning'
        : p.stockStatus === 'in-stock'
          ? 'checkmark-circle'
          : 'help-circle-outline';

  const archived = !p.isActive;
  const unitAbbrev = p.baseUnit?.abbreviation || 'units';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.itemCard,
        pressed && { opacity: 0.85 },
        archived && { opacity: 0.65 },
      ]}
    >
      <View
        style={[
          styles.itemIcon,
          p.pharmacyProduct && { backgroundColor: c.primarySoft },
        ]}
      >
        <Ionicons
          name={p.pharmacyProduct ? 'medical' : 'cube-outline'}
          size={18}
          color={c.link}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemName} numberOfLines={1}>
          {p.name}
        </Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {archived ? 'Archived · ' : ''}
          {p.pharmacyProduct
            ? p.pharmacyProduct.genericName || 'Medicine'
            : 'Retail'}
          {p.branchProducts?.length
            ? ` · ${p.branchProducts.length} branch${
                p.branchProducts.length === 1 ? '' : 'es'
              }`
            : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={styles.itemStock}>
          {p.totalStock} {unitAbbrev}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={toneIcon} size={11} color={toneColor} />
          <Text style={[styles.itemStatusText, { color: toneColor }]}>
            {p.stockStatusLabel}
          </Text>
        </View>
        <Text style={styles.itemPrice}>{formatCurrency(p.price)}</Text>
      </View>
    </Pressable>
  );
});

/* ── screen ────────────────────────────────────────────────────── */

export default function InventoryScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, productInstances } = useOrganizationContext();
  const { can } = usePermissionsContext();
  const { formatCurrency } = useSettings();

  const canCreate = can(KXTILL.INVENTORY.CREATE);
  const isPharmacyOrg = useMemo(
    () => productInstances?.some((i) => i.vertical === 'pharmacy'),
    [productInstances]
  );

  /* data */
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const [categories, setCategories] = useState([]);

  /* filters — atomic object, debounced */
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);

  /* refs */
  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const dataRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    dataRef.current = items;
  }, [items]);

  /* params built from debounced filters */
  const buildParams = useCallback(
    (offset = 0, f = debouncedFilters) => {
      const params = { limit: PAGE_SIZE, offset };
      if (f.search) params.search = f.search;
      if (f.status !== 'all') params.status = f.status;
      if (f.type !== 'all' && isPharmacyOrg) params.type = f.type;
      if (f.category !== 'all') params.category = f.category;
      if (f.showArchived) params.includeArchived = 'true';
      return params;
    },
    [debouncedFilters, isPharmacyOrg]
  );

  /* load */
  const load = useCallback(
    async (isRefresh = false) => {
      const orgId = activeOrganization?.id;
      if (!orgId) {
        setLoading(false);
        return;
      }
      const myToken = ++tokenRef.current;
      if (isRefresh) setRefreshing(true);
      else if (dataRef.current.length === 0) setLoading(true);
      setError(null);

      if (!isRefresh && dataRef.current.length === 0) {
        const cached = await readCache(orgId);
        if (mountedRef.current && myToken === tokenRef.current && cached) {
          setItems(cached.payload.items || []);
          setCounts(cached.payload.counts || null);
          setTotal(cached.payload.total || 0);
          setHasMore(cached.payload.hasMore || false);
          setCategories(Object.keys(cached.payload.counts?.byCategory || {}));
          setLoading(false);
        }
      }

      try {
        const { data } = await api.get(
          `/api/v1/organizations/${orgId}/kxtill/inventory/products`,
          { params: buildParams(0) }
        );
        if (!mountedRef.current || myToken !== tokenRef.current) return;

        setItems(data.items || []);
        setCounts(data.counts || null);
        setTotal(data.total || 0);
        setHasMore(!!data.hasMore);
        setCategories(Object.keys(data.counts?.byCategory || {}));
        setStaleError(null);

        writeCache(orgId, {
          items: data.items || [],
          counts: data.counts || null,
          total: data.total || 0,
          hasMore: !!data.hasMore,
        });
      } catch (e) {
        if (!mountedRef.current || myToken !== tokenRef.current) return;
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Could not load inventory';
        if (dataRef.current.length > 0) setStaleError(message);
        else setError(message);
      } finally {
        if (mountedRef.current && myToken === tokenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOrganization?.id, buildParams]
  );

  /* load more — capture token to prevent appending stale page */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !activeOrganization?.id) return;
    const myToken = tokenRef.current;
    setLoadingMore(true);
    try {
      const { data } = await api.get(
        `/api/v1/organizations/${activeOrganization.id}/kxtill/inventory/products`,
        { params: buildParams(items.length) }
      );
      if (!mountedRef.current || myToken !== tokenRef.current) return;
      setItems((prev) => [...prev, ...(data.items || [])]);
      setHasMore(!!data.hasMore);
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current && myToken === tokenRef.current) {
        setLoadingMore(false);
      }
    }
  }, [
    loadingMore,
    hasMore,
    activeOrganization?.id,
    buildParams,
    items.length,
  ]);

  /* (re)load when debounced filters change OR org changes */
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters, activeOrganization?.id]);

  /* reload on focus (back from ProductForm → new product appears) */
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load(true));
    return unsub;
  }, [navigation, load]);

  /* callbacks */
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.type !== 'all' && isPharmacyOrg ? 1 : 0) +
    (filters.showArchived ? 1 : 0);

  const hasActiveFilters =
    activeFilterCount > 0 || !!filters.search || filters.status !== 'all';

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(ROUTES.BRANCH_HOME);
  }, [navigation]);

  const onCreate = useCallback(() => {
    navigation.navigate(ROUTES.PRODUCT_FORM, { mode: 'create' });
  }, [navigation]);

  const onOpenProduct = useCallback(
    (p) =>
      navigation.navigate(ROUTES.PRODUCT_DETAIL, {
        productId: p.id,
        product: p,
      }),
    [navigation]
  );

  /* render */
  if (loading && items.length === 0 && !error) {
    return <InventorySkeleton styles={styles} insets={insets} />;
  }

  const emptyTitle = hasActiveFilters ? 'No products match' : 'No products yet';
  const emptySub = hasActiveFilters
    ? 'Adjust or clear filters to see more.'
    : canCreate
      ? 'Tap Add to create your first product.'
      : 'Ask an owner to add products.';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={c.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderWrap}>
            <Header
              c={c}
              styles={styles}
              orgName={activeOrganization?.name}
              counts={counts}
              status={filters.status}
              onChangeStatus={(id) =>
                setFilters((f) => ({ ...f, status: id }))
              }
              onCommitSearch={(s) => setFilters((f) => ({ ...f, search: s }))}
              onOpenFilters={() => setShowFilters(true)}
              activeFilterCount={activeFilterCount}
              onBack={onBack}
              canCreate={canCreate}
              onCreate={onCreate}
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

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={40} color={c.textMuted} />
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyText}>{emptySub}</Text>
                {hasActiveFilters ? (
                  <Pressable onPress={clearFilters} style={styles.clearBtn}>
                    <Text style={{ color: c.textOnPrimary, fontWeight: '800' }}>
                      Clear filters
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={styles.rowWrap}>
            <Row
              p={p}
              styles={styles}
              c={c}
              formatCurrency={formatCurrency}
              onPress={() => onOpenProduct(p)}
            />
          </View>
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.footerWrap}>
              {loadingMore ? (
                <ActivityIndicator color={c.primary} />
              ) : !hasMore ? (
                <Text style={styles.footerText}>
                  {items.length} of {total}
                </Text>
              ) : (
                <Text style={styles.footerText}>
                  Scroll for more · {items.length} of {total}
                </Text>
              )}
            </View>
          ) : null
        }
      />

      <FilterSheet
        c={c}
        styles={styles}
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        counts={counts}
        categories={categories}
        filters={filters}
        setFilters={setFilters}
        isPharmacyOrg={isPharmacyOrg}
        onClear={clearFilters}
      />
    </View>
  );
}

/* ── styles ────────────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

    scroll: {
      paddingBottom: spacing.xxl,
      paddingTop: 8,
    },

    listHeaderWrap: {
      marginBottom: spacing.md,
    },

    body: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },

    skeletonHeaderWrap: {
      marginTop: 8,
      marginBottom: spacing.md,
    },
    skeletonRowWrap: {
      marginBottom: 0,
    },

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
      marginBottom: 12,
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
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

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
      fontSize: 14,
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
      marginBottom: 12,
    },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surfaceElevated,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 14, padding: 0 },

    filterRow: { flexDirection: 'row', gap: 6 },
    filterPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterPillActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterText: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: '700',
    },
    filterTextActive: { color: c.textOnPrimary },

    filterSheetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      marginTop: 8,
      borderRadius: 12,
      backgroundColor: c.surfaceElevated,
    },
    filterSheetText: { color: c.link, fontSize: 12, fontWeight: '800' },

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

    rowWrap: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    itemIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemName: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    itemSub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    itemStock: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    itemStatusText: { fontSize: 10, fontWeight: '800' },
    itemPrice: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },

    footerWrap: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    footerText: {
      ...typography.caption,
      color: c.textMuted,
      fontWeight: '600',
    },

    emptyState: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.sm,
    },
    emptyText: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 280,
    },
    clearBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.primary,
    },

    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '800', color: c.textPrimary },
    sheetLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    sheetToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    sheetBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
  });