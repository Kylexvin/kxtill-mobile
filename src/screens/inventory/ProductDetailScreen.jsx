// src/screens/inventory/ProductDetailScreen.jsx
//
// Product detail — floating header card, matching the app's other
// detail screens (BranchHome, BranchSales, Receipts, Inventory).
//
// Header: back + monogram + stock-status chip · identity · 3 stat chips ·
// action strip (Edit · Archive/Restore · Share). Actions live in the
// header, not a sticky footer.
//
// Body: PHARMACY (if medicine) · PRICING · BRANCHES (with stock bars).
//
// Refetches on focus so edits from ProductForm propagate back. Fetches
// if route.params.product is missing (deep link / refresh).

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
  Pressable,
  Modal,
  ActivityIndicator,
  Animated,
  Share,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissionsContext } from '../../context/PermissionsContext';
import { useSettings } from '../../context/SettingsContext';
import inventoryService from '../../services/inventory.service';
import { KXTILL } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';

/* ── helpers ──────────────────────────────────────────────── */

function branchNameOf(bp) {
  return bp?.branchName || bp?.branch?.name || 'Branch';
}

function branchKeyOf(bp, i) {
  return bp?.branchId || bp?.branch?.id || bp?.id || `bp-${i}`;
}

function stockRatio(bp) {
  const stock = Number(bp?.stock || 0);
  const min = Number(bp?.minStock || 0);
  const ceiling = Math.max(min * 2, stock, 10);
  return Math.min(1, stock / ceiling);
}

function stockStatusOfProduct(product) {
  const bps = product?.branchProducts || [];
  if (bps.length === 0) {
    return {
      key: 'no-branch',
      label: 'No branch',
      icon: 'help-circle-outline',
      tone: 'muted',
    };
  }
  const out = bps.filter((b) => Number(b.stock) <= 0).length;
  const low = bps.filter(
    (b) =>
      Number(b.stock) > 0 && Number(b.stock) <= Number(b.minStock || 0)
  ).length;
  if (out === bps.length) {
    return { key: 'out-of-stock', label: 'Out', icon: 'alert-circle', tone: 'danger' };
  }
  if (low + out === bps.length) {
    return { key: 'low-stock', label: 'Low', icon: 'warning', tone: 'warning' };
  }
  if (low + out > 0) {
    return {
      key: 'low-stock',
      label: `${low + out}/${bps.length} low`,
      icon: 'warning',
      tone: 'warning',
    };
  }
  return { key: 'in-stock', label: 'In stock', icon: 'checkmark-circle', tone: 'success' };
}

/* ── skeleton ─────────────────────────────────────────────── */

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

function DetailSkeleton({ styles, insets }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={false}
      >
        <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
          <View style={styles.headerTop}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Sk width={36} height={36} r={18} />
              <Sk width={36} height={36} r={12} />
            </View>
            <Sk width={90} height={24} r={12} />
          </View>
          <Sk width="55%" height={22} r={8} style={{ marginTop: 4 }} />
          <Sk
            width="40%"
            height={13}
            r={6}
            style={{ marginTop: 6 }}
          />
          <View style={styles.chipRow}>
            <Sk width="31%" height={32} r={12} />
            <Sk width="31%" height={32} r={12} />
            <Sk width="31%" height={32} r={12} />
          </View>
          <View style={styles.headerRule} />
          <View style={styles.actionRow}>
            <Sk width="31%" height={42} r={12} />
            <Sk width="31%" height={42} r={12} />
            <Sk width="31%" height={42} r={12} />
          </View>
        </View>

        <View style={styles.body}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.section}>
              <Sk
                width={90}
                height={11}
                r={5}
                style={{ marginBottom: 8 }}
              />
              <View style={styles.sectionBody}>
                <Sk
                  width="100%"
                  height={20}
                  r={6}
                  style={{ marginVertical: 4 }}
                />
                <Sk
                  width="100%"
                  height={20}
                  r={6}
                  style={{ marginVertical: 4 }}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── header ──────────────────────────────────────────────── */

function FloatingHeader({
  c,
  styles,
  insets,
  product,
  isMedicine,
  archived,
  status,
  canUpdate,
  canDelete,
  submitting,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onShare,
}) {
  const bu = product.baseUnit || {};
  const ph = product.pharmacyProduct || {};
  const monogram = (product.name || 'P').trim().charAt(0).toUpperCase();
  const totalStock = Number(product.totalStock || 0);
  const branchCount = product.branchProducts?.length || 0;
  const price = Number(bu.price || product.price || 0);

  const toneMap = {
    success: { fg: c.success, bg: c.successSoft || c.primarySoft },
    warning: { fg: c.warning, bg: c.primarySoft },
    danger: { fg: c.danger, bg: c.dangerSoft },
    muted: { fg: c.textMuted, bg: c.surfaceElevated },
  };
  const tone = toneMap[status.tone] || toneMap.muted;

  const statusForArchived = archived
    ? {
        label: 'Archived',
        icon: 'archive',
        fg: c.danger,
        bg: c.dangerSoft,
      }
    : {
        label: status.label,
        icon: status.icon,
        fg: tone.fg,
        bg: tone.bg,
      };

  return (
    <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
      <View pointerEvents="none" style={styles.headerGlow} />

      <View style={styles.headerTop}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={c.textPrimary}
            />
          </Pressable>
          <View
            style={[
              styles.monogramSmall,
              isMedicine && { backgroundColor: c.primary },
            ]}
          >
            <Text style={styles.monogramSmallText}>{monogram}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusChip,
            { backgroundColor: statusForArchived.bg },
          ]}
        >
          <Ionicons
            name={statusForArchived.icon}
            size={11}
            color={statusForArchived.fg}
          />
          <Text
            style={[styles.statusText, { color: statusForArchived.fg }]}
          >
            {statusForArchived.label}
          </Text>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isMedicine ? ph.genericName || 'Medicine' : 'Retail'}
            {product.category ? ` · ${product.category}` : ''}
          </Text>
          {product.sku ? (
            <Text style={styles.headerSku} numberOfLines={1}>
              SKU {product.sku}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.statChip}>
          <Ionicons
            name="cube-outline"
            size={13}
            color={tone.fg}
          />
          <Text style={[styles.statChipValue, { color: tone.fg }]}>
            {totalStock}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            {bu.abbreviation || 'units'}
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons name="pricetag-outline" size={13} color={c.link} />
          <Text
            style={styles.statChipValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {price}
          </Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            price
          </Text>
        </View>
        <View style={styles.statChip}>
          <Ionicons
            name="storefront-outline"
            size={13}
            color={c.link}
          />
          <Text style={styles.statChipValue}>{branchCount}</Text>
          <Text style={styles.statChipLabel} numberOfLines={1}>
            branches
          </Text>
        </View>
      </View>

      <View style={styles.headerRule} />

      <View style={styles.actionRow}>
        {!archived && canUpdate ? (
          <Pressable
            onPress={onEdit}
            style={[styles.actionBtn, { backgroundColor: c.primary }]}
            accessibilityRole="button"
          >
            <Ionicons
              name="create-outline"
              size={14}
              color={c.textOnPrimary}
            />
            <Text style={styles.actionPrimaryText}>Edit</Text>
          </Pressable>
        ) : null}
        {!archived && canDelete ? (
          <Pressable
            onPress={onArchive}
            style={[
              styles.actionBtn,
              {
                backgroundColor: c.dangerSoft,
              },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="archive-outline" size={14} color={c.danger} />
            <Text style={[styles.actionSecondaryText, { color: c.danger }]}>
              Archive
            </Text>
          </Pressable>
        ) : null}
        {archived && canUpdate ? (
          <Pressable
            onPress={onRestore}
            disabled={submitting}
            style={[styles.actionBtn, { backgroundColor: c.primary }]}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={c.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color={c.textOnPrimary}
                />
                <Text style={styles.actionPrimaryText}>Restore</Text>
              </>
            )}
          </Pressable>
        ) : null}
        <Pressable
          onPress={onShare}
          style={[
            styles.actionBtn,
            {
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            },
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="share-outline" size={14} color={c.link} />
          <Text style={styles.actionSecondaryText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── screen ───────────────────────────────────────────────── */

export default function ProductDetailScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { can } = usePermissionsContext();
  const { formatCurrency } = useSettings();

  const routeProduct = route.params?.product || null;
  const routeProductId = route.params?.productId || null;

  const [product, setProduct] = useState(routeProduct);
  const [loading, setLoading] = useState(!routeProduct);
  const [showArchive, setShowArchive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canUpdate = can(KXTILL.INVENTORY.UPDATE);
  const canDelete = can(KXTILL.INVENTORY.DELETE);

  const refetch = useCallback(async () => {
    const orgId = activeOrganization?.id;
    const productId = routeProductId || product?.id;
    if (!orgId || !productId) return;
    try {
      const fresh = await inventoryService.getProduct(orgId, productId);
      if (mountedRef.current && fresh) setProduct(fresh);
    } catch {
      /* silent */
    }
  }, [activeOrganization?.id, routeProductId, product?.id]);

  useEffect(() => {
    if (product || !activeOrganization?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      await refetch();
      if (mountedRef.current) setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const doArchive = async () => {
    if (!activeOrganization?.id) return;
    setSubmitting(true);
    setErr(null);
    try {
      await inventoryService.archiveProduct(
        activeOrganization.id,
        product.id
      );
      setShowArchive(false);
      navigation.goBack();
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          'Failed to archive'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const doRestore = async () => {
    if (!activeOrganization?.id) return;
    setSubmitting(true);
    setErr(null);
    try {
      await inventoryService.updateProduct(
        activeOrganization.id,
        product.id,
        { isActive: true }
      );
      await refetch();
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          'Failed to restore'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const doShare = async () => {
    if (!product) return;
    const bu = product.baseUnit || {};
    const lines = [];
    lines.push(product.name);
    if (product.sku) lines.push(`SKU ${product.sku}`);
    if (product.category) lines.push(product.category);
    if (product.pharmacyProduct?.genericName) {
      lines.push(
        `${product.pharmacyProduct.genericName}${
          product.pharmacyProduct.strength
            ? ` ${product.pharmacyProduct.strength}`
            : ''
        }`
      );
    }
    lines.push('');
    lines.push(
      `Price: ${formatCurrency(
        Number(bu.price || product.price || 0)
      )}`
    );
    lines.push(`Unit: ${bu.name || '—'} (${bu.abbreviation || '—'})`);
    if (product.totalStock != null) {
      lines.push(
        `Stock: ${product.totalStock} ${bu.abbreviation || 'u'}`
      );
    }
    if (product.branchProducts?.length) {
      lines.push('');
      lines.push('Branches:');
      for (const bp of product.branchProducts) {
        lines.push(
          `• ${branchNameOf(bp)}: ${bp.stock}/${bp.minStock} ${
            bu.abbreviation || 'u'
          }`
        );
      }
    }
    try {
      await Share.share({
        title: product.name,
        message: lines.join('\n'),
      });
    } catch {
      /* user cancelled */
    }
  };

  if (loading && !product) {
    return <DetailSkeleton styles={styles} insets={insets} />;
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={c.textMuted}
          />
          <Text style={styles.emptyTitle}>Product unavailable</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.primaryBtn}
          >
            <Text style={{ color: c.textOnPrimary, fontWeight: '800' }}>
              Close
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isMedicine = !!product.pharmacyProduct;
  const archived = !product.isActive;
  const bu = product.baseUnit || {};
  const ph = product.pharmacyProduct || {};
  const status = stockStatusOfProduct(product);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FloatingHeader
          c={c}
          styles={styles}
          insets={insets}
          product={product}
          isMedicine={isMedicine}
          archived={archived}
          status={status}
          canUpdate={canUpdate}
          canDelete={canDelete}
          submitting={submitting}
          onBack={() => navigation.goBack()}
          onEdit={() =>
            navigation.navigate(ROUTES.PRODUCT_FORM, {
              mode: 'edit',
              product,
            })
          }
          onArchive={() => setShowArchive(true)}
          onRestore={doRestore}
          onShare={doShare}
        />

        {err ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {isMedicine ? (
            <Section title="PHARMACY" styles={styles}>
              <Row label="Generic" value={ph.genericName} styles={styles} />
              <Row label="Strength" value={ph.strength} styles={styles} />
              <Row
                label="Dosage form"
                value={ph.dosageForm}
                styles={styles}
              />
            </Section>
          ) : null}

          <Section title="PRICING" styles={styles}>
            <Row
              label="Base price"
              value={formatCurrency(
                Number(bu.price || product.price || 0)
              )}
              styles={styles}
            />
            <Row
              label="Cost"
              value={formatCurrency(
                Number(bu.cost || product.cost || 0)
              )}
              styles={styles}
            />
            <Row
              label="Unit"
              value={`${bu.name || '—'} (${bu.abbreviation || '—'})`}
              styles={styles}
            />
          </Section>

          <Section
            title={`BRANCHES (${product.branchProducts?.length || 0})`}
            styles={styles}
          >
            {product.branchProducts?.length ? (
              product.branchProducts.map((bp, i) => {
                const out = Number(bp.stock) <= 0;
                const low =
                  Number(bp.stock) > 0 &&
                  Number(bp.stock) <= Number(bp.minStock);
                const tone = out
                  ? c.danger
                  : low
                    ? c.warning
                    : c.success;
                const ratio = stockRatio(bp);
                return (
                  <View key={branchKeyOf(bp, i)} style={styles.bpRow}>
                    <View style={styles.bpTop}>
                      <Text style={styles.bpName} numberOfLines={1}>
                        {branchNameOf(bp)}
                      </Text>
                      <Text style={[styles.bpStock, { color: tone }]}>
                        {bp.stock}/{bp.minStock}{' '}
                        {bu.abbreviation || 'u'}
                      </Text>
                    </View>
                    <View style={styles.bpBarTrack}>
                      <View
                        style={[
                          styles.bpBarFill,
                          {
                            width: `${Math.max(
                              4,
                              Math.round(ratio * 100)
                            )}%`,
                            backgroundColor: tone,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.bpEmpty}>
                Not stocked in any branch yet.
              </Text>
            )}
          </Section>
        </View>
      </ScrollView>

      <Modal
        visible={showArchive}
        transparent
        animationType="fade"
        onRequestClose={() => setShowArchive(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View
              style={[
                styles.confirmIcon,
                { backgroundColor: c.dangerSoft },
              ]}
            >
              <Ionicons
                name="archive-outline"
                size={28}
                color={c.danger}
              />
            </View>
            <Text style={styles.confirmTitle}>Archive product?</Text>
            <Text style={styles.confirmBody}>
              <Text style={{ fontWeight: '800' }}>{product.name}</Text> will
              be hidden from POS and inventory. Sales history stays intact.
              You can restore it later.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setShowArchive(false)}
                disabled={submitting}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: c.surfaceElevated },
                ]}
              >
                <Text
                  style={{ color: c.textPrimary, fontWeight: '800' }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={doArchive}
                disabled={submitting}
                style={[styles.confirmBtn, { backgroundColor: c.danger }]}
              >
                {submitting ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text
                    style={{ color: c.textOnPrimary, fontWeight: '800' }}
                  >
                    Archive
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── atoms ────────────────────────────────────────────────── */

function Section({ title, children, styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, styles }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxl },
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

    identityRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
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
    headerSku: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 4,
      fontVariant: ['tabular-nums'],
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
      fontSize: 13,
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

    actionRow: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 42,
      borderRadius: 12,
    },
    actionPrimaryText: {
      color: c.textOnPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    actionSecondaryText: {
      color: c.link,
      fontSize: 13,
      fontWeight: '800',
    },

    // Body sections
    section: { marginTop: spacing.md },
    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    sectionBody: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    rowValue: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      maxWidth: '60%',
      textAlign: 'right',
    },

    bpRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    bpTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    bpName: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    bpStock: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    bpBarTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.surfaceElevated,
      overflow: 'hidden',
    },
    bpBarFill: { height: '100%', borderRadius: 2 },
    bpEmpty: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      paddingVertical: 6,
    },

    errBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
    },
    errText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },

    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: spacing.xl,
    },
    emptyTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '800' },
    primaryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.primary,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    confirmModal: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 380,
    },
    confirmIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 12,
    },
    confirmTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '900',
      textAlign: 'center',
    },
    confirmBody: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 8,
    },
    confirmActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    confirmBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });