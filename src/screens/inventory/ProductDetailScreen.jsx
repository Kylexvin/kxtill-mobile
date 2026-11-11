// src/screens/inventory/ProductDetailScreen.jsx
//
// Full-bleed product detail. No floating card.
// Barcode rendered via bwip-js toDataURL() + RN <Image>.

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
  Image,
  PixelRatio,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import bwipjs from '@bwip-js/react-native';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { usePermissionsContext } from '../../context/PermissionsContext';
import { useSettings } from '../../context/SettingsContext';
import inventoryService from '../../services/inventory.service';
import { KXTILL } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';

function stockInfo(product) {
  const bps = Array.isArray(product?.branchProducts)
    ? product.branchProducts
    : [];
  const hasBranches = bps.length > 0;
  const total = hasBranches
    ? bps.reduce((s, b) => s + Number(b.stock || 0), 0)
    : Number(product?.stock ?? product?.totalStock ?? 0);
  const min = hasBranches
    ? bps.reduce((s, b) => s + Number(b.minStock || 0), 0)
    : Number(product?.minStock ?? 0);

  if (total <= 0) {
    return { tone: 'danger', label: 'Out of stock', total, min, bps };
  }
  if (total <= min) {
    return { tone: 'warning', label: 'Low stock', total, min, bps };
  }
  return { tone: 'success', label: 'In stock', total, min, bps };
}

function pickBarcodeSymbol(barcode) {
  const s = String(barcode || '');
  if (/^\d{13}$/.test(s)) return 'ean13';
  if (/^\d{12}$/.test(s)) return 'upca';
  if (/^\d{8}$/.test(s)) return 'ean8';
  return 'code128';
}

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
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTop}>
          <Sk width={40} height={40} r={20} />
          <Sk width={90} height={26} r={13} />
        </View>
        <Sk width="70%" height={28} r={8} style={{ marginTop: 22 }} />
        <Sk width="45%" height={14} r={6} style={{ marginTop: 10 }} />
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Sk width={40} height={11} r={5} />
            <Sk width={90} height={32} r={8} style={{ marginTop: 10 }} />
          </View>
          <View style={styles.heroStat}>
            <Sk width={40} height={11} r={5} />
            <Sk width={90} height={32} r={8} style={{ marginTop: 10 }} />
          </View>
        </View>
      </View>
      <View style={styles.body}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.section}>
            <Sk width={90} height={11} r={5} style={{ marginBottom: 10 }} />
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
    </SafeAreaView>
  );
}

/**
 * Renders a barcode using bwip-js's toDataURL() + RN <Image>.
 * Returns null while generating or if generation fails.
 */
function BarcodeImage({ barcodeValue }) {
  const [source, setSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    if (!barcodeValue) return;

    const symbol = pickBarcodeSymbol(barcodeValue);
    bwipjs
      .toDataURL({
        bcid: symbol,
        text: String(barcodeValue),
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: 'center',
        textsize: 8,
        paddingwidth: 0,
        paddingheight: 0,
        backgroundcolor: '#FFFFFF',
        barcolor: '#000000',
      })
      .then((img) => {
        if (!cancelled) setSource(img);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [barcodeValue]);

  if (!source) return null;

  return (
    <Image
      source={{ uri: source.uri }}
      style={{ width: '100%', height: 90 }}
      resizeMode="contain"
    />
  );
}

export default function ProductDetailScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganizationContext();
  const { can } = usePermissionsContext();
  const { formatCurrency } = useSettings();

  const routeProduct = route.params?.product || null;
  const routeProductId =
    route.params?.productId || route.params?.product?.id || null;

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
    if (!activeOrganization?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      await refetch();
      if (mountedRef.current) setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id, routeProductId]);

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

  if (loading && !product) {
    return <DetailSkeleton styles={styles} insets={insets} />;
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="alert-circle-outline"
              size={36}
              color={c.textMuted}
            />
          </View>
          <Text style={styles.emptyTitle}>Product unavailable</Text>
          <Text style={styles.emptyBody}>
            It may have been removed or you don't have access.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isMedicine = !!product.pharmacyProduct;
  const archived = !product.isActive;
  const bu = product.baseUnit || {};
  const ph = product.pharmacyProduct || {};
  const stock = stockInfo(product);
  const price = Number(bu.price || product.price || 0);
  const cost = Number(bu.cost || product.cost || 0);
  const barcodeValue = bu.barcode || product.barcode || null;

  const toneFg =
    stock.tone === 'danger'
      ? c.danger
      : stock.tone === 'warning'
        ? c.warning
        : c.success;
  const toneBg =
    stock.tone === 'danger'
      ? c.dangerSoft
      : stock.tone === 'warning'
        ? c.primarySoft
        : c.successSoft || c.primarySoft;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={styles.heroBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={c.textPrimary}
              />
            </Pressable>
            <View style={[styles.statusChip, { backgroundColor: toneBg }]}>
              <Ionicons name="ellipse" size={8} color={toneFg} />
              <Text style={[styles.statusText, { color: toneFg }]}>
                {archived ? 'Archived' : stock.label}
              </Text>
            </View>
          </View>

          <Text style={styles.heroName} numberOfLines={3}>
            {product.name}
          </Text>
          <View style={styles.heroMetaRow}>
            {isMedicine ? (
              <View style={styles.heroTag}>
                <Ionicons
                  name="medkit-outline"
                  size={11}
                  color={c.link}
                />
                <Text style={styles.heroTagText}>
                  {ph.genericName || 'Medicine'}
                </Text>
              </View>
            ) : null}
            {product.category ? (
              <View style={styles.heroTag}>
                <Ionicons
                  name="pricetag-outline"
                  size={11}
                  color={c.link}
                />
                <Text style={styles.heroTagText}>
                  {product.category}
                </Text>
              </View>
            ) : null}
            {product.sku ? (
              <View style={styles.heroTag}>
                <Ionicons
                  name="barcode-outline"
                  size={11}
                  color={c.link}
                />
                <Text style={styles.heroTagText}>{product.sku}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>STOCK</Text>
              <Text style={[styles.heroStatValue, { color: toneFg }]}>
                {stock.total}
                <Text style={styles.heroStatUnit}>
                  {' '}
                  {bu.abbreviation || 'units'}
                </Text>
              </Text>
              {stock.min > 0 ? (
                <Text style={styles.heroStatHint}>min {stock.min}</Text>
              ) : null}
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>PRICE</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {formatCurrency(price)}
              </Text>
              <Text style={styles.heroStatHint}>
                {bu.name || 'base unit'}
              </Text>
            </View>
          </View>
        </View>

        {err ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={c.danger} />
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {barcodeValue ? (
            <View style={styles.barcodeSection}>
              <Text style={styles.sectionLabel}>BARCODE</Text>
              <View style={styles.barcodeCard}>
                <View style={styles.barcodeWrap}>
                  <BarcodeImage barcodeValue={barcodeValue} />
                </View>
                <Text style={styles.barcodeNumber}>{barcodeValue}</Text>
              </View>
            </View>
          ) : null}

          {isMedicine ? (
            <Section title="PHARMACY" styles={styles}>
              <Row label="Generic" value={ph.genericName} styles={styles} />
              <Row label="Brand" value={ph.brandName} styles={styles} />
              <Row label="Strength" value={ph.strength} styles={styles} />
              <Row label="Dosage" value={ph.dosageForm} styles={styles} />
              <Row
                label="Prescription"
                value={ph.prescriptionCategory}
                styles={styles}
              />
            </Section>
          ) : null}

          <Section title="PRICING" styles={styles}>
            <Row
              label="Selling price"
              value={formatCurrency(price)}
              styles={styles}
            />
            <Row
              label="Cost"
              value={cost > 0 ? formatCurrency(cost) : null}
              styles={styles}
            />
            <Row
              label="Margin"
              value={
                price > 0 && cost > 0
                  ? formatCurrency(price - cost)
                  : null
              }
              styles={styles}
            />
            <Row
              label="Base unit"
              value={bu.name || null}
              styles={styles}
            />
            <Row
              label="Abbreviation"
              value={bu.abbreviation || null}
              styles={styles}
            />
 
          </Section>

          {stock.bps.length > 0 ? (
            <Section
              title={`BRANCHES (${stock.bps.length})`}
              styles={styles}
            >
              {stock.bps.map((bp, i) => {
                const s = Number(bp.stock || 0);
                const m = Number(bp.minStock || 0);
                const t =
                  s <= 0 ? c.danger : s <= m ? c.warning : c.success;
                return (
                  <View
                    key={bp.branchId || i}
                    style={[
                      styles.branchRow,
                      i === stock.bps.length - 1 && styles.lastRow,
                    ]}
                  >
                    <Text style={styles.branchName} numberOfLines={1}>
                      {bp.branchName || bp.branch?.name || 'Branch'}
                    </Text>
                    <Text style={[styles.branchStock, { color: t }]}>
                      {s}
                      <Text style={styles.branchStockUnit}>
                        {' '}
                        {bu.abbreviation || 'u'}
                      </Text>
                    </Text>
                  </View>
                );
              })}
            </Section>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {!archived && canUpdate ? (
          <Pressable
            onPress={() =>
              navigation.navigate(ROUTES.PRODUCT_FORM, {
                mode: 'edit',
                product,
              })
            }
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            accessibilityRole="button"
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={c.textOnPrimary}
            />
            <Text style={styles.actionBtnPrimaryText}>Edit product</Text>
          </Pressable>
        ) : null}
        {!archived && canDelete ? (
          <Pressable
            onPress={() => setShowArchive(true)}
            style={[styles.actionBtn, styles.actionBtnDanger]}
            accessibilityRole="button"
          >
            <Ionicons name="archive-outline" size={18} color={c.danger} />
            <Text style={styles.actionBtnDangerText}>Archive</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={showArchive}
        transparent
        animationType="fade"
        onRequestClose={() => setShowArchive(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View
              style={[styles.confirmIcon, { backgroundColor: c.dangerSoft }]}
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

function Section({ title, children, styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, styles }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 96 },
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: 8,
      paddingBottom: spacing.xl,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      backgroundColor: c.background,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroBack: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

    heroName: {
      color: c.textPrimary,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '900',
      letterSpacing: -0.6,
      marginTop: 22,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
    },
    heroTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    heroTagText: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },

    heroStats: {
      flexDirection: 'row',
      marginTop: 24,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    heroStat: { flex: 1 },
    heroStatDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: spacing.lg,
    },
    heroStatLabel: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    heroStatValue: {
      color: c.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.6,
      marginTop: 6,
      fontVariant: ['tabular-nums'],
    },
    heroStatUnit: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0,
    },
    heroStatHint: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },

    section: { marginTop: spacing.lg },
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
      paddingHorizontal: spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
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

    barcodeSection: { marginTop: spacing.lg },
    barcodeCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    barcodeWrap: {
      backgroundColor: '#FFFFFF',
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barcodeNumber: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 3,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },

    branchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    lastRow: { borderBottomWidth: 0 },
    branchName: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    branchStock: {
      fontSize: 14,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    branchStockUnit: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
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

    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.xl,
      paddingTop: 12,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      borderRadius: 14,
    },
    actionBtnPrimary: { backgroundColor: c.primary },
    actionBtnPrimaryText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    actionBtnDanger: {
      backgroundColor: c.dangerSoft,
      flex: 0,
      paddingHorizontal: 20,
    },
    actionBtnDangerText: {
      color: c.danger,
      fontSize: 15,
      fontWeight: '800',
    },

    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: spacing.xl,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 6,
    },
    emptyBody: {
      color: c.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 280,
      marginBottom: spacing.md,
    },
    primaryBtn: {
      marginTop: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: c.primary,
    },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontWeight: '800',
      fontSize: 15,
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