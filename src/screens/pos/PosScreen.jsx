// src/screens/pos/PosScreen.jsx
//
// POS orchestrator. State wiring + component composition only.

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import {
  usePosGate,
  usePosProducts,
  usePosCart,
  usePosSale,
  usePosReceipt,
} from './usePos';
import {
  PosHeader,
  PosSearchBar,
  PosCategoryChips,
  PosProductGrid,
  PosFooter,
  PosSnackbar,
} from './PosParts';
import {
  PosCustomerModal,
  PosReceiptModal,
  PosVariantModal,
} from './PosModals';
import { PosPaymentModal, PosCartModal, PosHeldModal } from './PosSheets';

const catLabel = (cat) =>
  !cat ? null : typeof cat === 'string' ? cat : cat.name || null;

export default function PosScreen() {
  const { theme: c } = useTheme();
  const styles = useStyles(c);
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const { activeOrganization, activeBranch } = useOrganizationContext();
  const { formatCurrency } = useSettings();

  const orgId = activeOrganization?.id ?? null;
  const branchId = route.params?.branchId ?? activeBranch?.id ?? null;

  const { gate, runGate, openShift } = usePosGate({ orgId, branchId });
  const productsState = usePosProducts({
    orgId,
    branchId,
    enabled: gate.status === 'ready',
  });
  const cartState = usePosCart();
  const saleState = usePosSale({
    orgId,
    branchId,
    gate,
    cart: cartState.cart,
    subtotal: cartState.subtotal,
    customer: cartState.customer,
    clientSaleIdRef: cartState.clientSaleIdRef,
    clearCart: cartState.clearCart,
  });
  const receiptState = usePosReceipt({ orgId });

  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [lastSaleId, setLastSaleId] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);

  // TODO: wire to your sync engine ('synced' | 'pending' | 'offline')
  const syncStatus = 'synced';

  useEffect(() => {
    if (!snackOpen) return undefined;
    const t = setTimeout(() => setSnackOpen(false), 5000);
    return () => clearTimeout(t);
  }, [snackOpen, lastSaleId]);

  const categories = useMemo(() => {
    const set = new Set();
    productsState.products.forEach((p) => {
      const l = catLabel(p.category);
      if (l) set.add(l);
    });
    return [...set];
  }, [productsState.products]);

  const visibleProducts = useMemo(
    () =>
      category
        ? productsState.products.filter((p) => catLabel(p.category) === category)
        : productsState.products,
    [productsState.products, category]
  );

  const inCart = useMemo(() => {
    const map = {};
    cartState.cart.forEach((l) => {
      map[l.productId] = (map[l.productId] || 0) + l.quantity;
    });
    return map;
  }, [cartState.cart]);

  const openPayment = (m) => {
    if (cartState.cart.length === 0) return;
    setMethod(m);
    setReference('');
    setPayOpen(true);
  };

  const confirmPayment = async () => {
    try {
      const sale = await saleState.submitSale({ method, reference });
      setPayOpen(false);
      setLastSaleId(sale.id);
      setSnackOpen(true);
    } catch (e) {
      Alert.alert(
        'Sale failed',
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          'Sale failed'
      );
    }
  };

  const handleAdd = (item) => {
    const units = item.units || [];
    if (units.length > 1) {
      setVariantProduct(item);
      return;
    }
    cartState.addToCart(item, units[0] || item.baseUnit);
  };

  const openMenu = () => {
    const buttons = [];
    if (lastSaleId) {
      buttons.push({ text: 'Last receipt', onPress: () => receiptState.show(lastSaleId) });
    }
    buttons.push({
      text: 'Clear cart',
      style: 'destructive',
      onPress: cartState.clearCart,
    });
    buttons.push({ text: 'Close POS', onPress: () => navigation.goBack() });
    Alert.alert('Menu', undefined, buttons);
  };

  /* ── gate states ─────────────────────────────────────────── */

  if (gate.status === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={c.primary} />
        <Text style={styles.centerText}>Preparing POS…</Text>
      </SafeAreaView>
    );
  }
  if (gate.status === 'error' || gate.status === 'blocked') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
        <Text style={styles.centerTitle}>
          {gate.status === 'blocked' ? 'Shift conflict' : 'POS unavailable'}
        </Text>
        <Text style={styles.centerText}>{gate.error}</Text>
        {gate.status === 'error' ? (
          <Pressable onPress={runGate} style={styles.centerBtn}>
            <Text style={styles.centerBtnText}>Retry</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  if (gate.status === 'no-shift') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="time-outline" size={28} color={c.link} />
        <Text style={styles.centerTitle}>Open a shift to start selling</Text>
        <Text style={styles.centerText}>
          This branch requires an open shift before taking sales.
        </Text>
        <Pressable onPress={openShift} style={styles.centerBtn}>
          <Text style={styles.centerBtnText}>Open shift</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /* ── ready ───────────────────────────────────────────────── */

  const cartEmpty = cartState.cart.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PosHeader
        syncStatus={syncStatus}
        heldCount={cartState.held.length}
        totalQty={cartState.totalQty}
        subtotal={cartState.subtotal}
        onSearch={() => setSearchOpen((v) => !v)}
        onHeld={() => setHeldOpen(true)}
        onCart={() => setCartOpen(true)}
        onMenu={openMenu}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />

      {searchOpen ? (
        <PosSearchBar
          query={productsState.query}
          setQuery={productsState.setQuery}
          onClose={() => setSearchOpen(false)}
          c={c}
          styles={styles}
        />
      ) : null}

      <PosCategoryChips
        categories={categories}
        active={category}
        onPick={setCategory}
        c={c}
        styles={styles}
      />

      <View style={{ flex: 1 }}>
        <PosProductGrid
          products={visibleProducts}
          inCart={inCart}
          searching={productsState.searching}
          error={productsState.error}
          query={productsState.query}
          onAdd={handleAdd}
          onRetry={productsState.reload}
          formatCurrency={formatCurrency}
          c={c}
          styles={styles}
        />
        <PosSnackbar
          visible={snackOpen}
          onReceipt={() => {
            setSnackOpen(false);
            receiptState.show(lastSaleId);
          }}
          c={c}
          styles={styles}
        />
      </View>

      <PosFooter
        totalQty={cartState.totalQty}
        subtotal={cartState.subtotal}
        cartEmpty={cartEmpty}
        onUndo={cartState.undoLast}
        onPayCash={() => openPayment('CASH')}
        onPayMpesa={() => openPayment('MPESA')}
        formatCurrency={formatCurrency}
        bottomInset={insets.bottom}
        c={c}
        styles={styles}
      />

      <PosCartModal
        visible={cartOpen}
        cart={cartState.cart}
        customer={cartState.customer}
        subtotal={cartState.subtotal}
        onChangeQty={cartState.changeQty}
        onCustomer={() => {
          setCartOpen(false);
          setCustomerOpen(true);
        }}
        onHold={() => {
          cartState.holdCurrent();
          setCartOpen(false);
        }}
        onClear={() => {
          cartState.clearCart();
          setCartOpen(false);
        }}
        onClose={() => setCartOpen(false)}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />

      <PosHeldModal
        visible={heldOpen}
        held={cartState.held}
        onRecall={(id) => {
          cartState.recall(id);
          setHeldOpen(false);
        }}
        onDiscard={cartState.discardHeld}
        onClose={() => setHeldOpen(false)}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />

      <PosCustomerModal
        visible={customerOpen}
        onClose={() => setCustomerOpen(false)}
        orgId={orgId}
        selected={cartState.customer}
        onSelect={(cst) => {
          cartState.setCustomer(cst);
          setCustomerOpen(false);
        }}
        c={c}
        styles={styles}
      />

      <PosPaymentModal
        visible={payOpen}
        submitting={saleState.submitting}
        subtotal={cartState.subtotal}
        customer={cartState.customer}
        method={method}
        setMethod={setMethod}
        reference={reference}
        setReference={setReference}
        onClose={() => setPayOpen(false)}
        onConfirm={confirmPayment}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />

      <PosReceiptModal
        visible={receiptState.open}
        loading={receiptState.loading}
        receipt={receiptState.receipt}
        onClose={receiptState.close}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />

      <PosVariantModal
        visible={!!variantProduct}
        product={variantProduct}
        onClose={() => setVariantProduct(null)}
        onPick={(prod, unit) => {
          cartState.addToCart(prod, unit);
          setVariantProduct(null);
        }}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />
    </SafeAreaView>
  );
}

/* ── styles ─────────────────────────────────────────────────── */

function useStyles(c) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

    /* gate / centered states */
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
      backgroundColor: c.background,
    },
    centerTitle: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 6,
      textAlign: 'center',
    },
    centerText: {
      color: c.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    centerBtn: {
      marginTop: 12,
      backgroundColor: c.primary,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 12,
    },
    centerBtnText: { color: c.textOnPrimary, fontWeight: '800' },
    centerLink: { marginTop: 6 },
    centerLinkText: { color: c.link, fontWeight: '700' },

    /* header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    syncDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    cartPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: c.primary,
    },
    cartPillText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    iconBtnDisabled: { opacity: 0.45 },

    /* search */
    searchRow: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, color: c.textPrimary, fontSize: 16, padding: 0 },

    /* category chips */
    chipsWrap: { paddingBottom: 8 },
    catChip: {
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    catChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    catChipText: { color: c.textPrimary, fontSize: 14, fontWeight: '800' },
    catChipTextActive: { color: c.textOnPrimary },

    /* grid */
    gridContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: 12,
      flexGrow: 1,
    },
    gridRow: { gap: 8, marginBottom: 8 },
    tile: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 10,
      minHeight: 92,
      justifyContent: 'space-between',
    },
    tileActive: { borderColor: c.primary, borderWidth: 2 },
    tilePressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    tileDisabled: { opacity: 0.5 },
    tileName: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 17,
      paddingRight: 14,
    },
    tileNameDisabled: { color: c.textMuted },
    tileBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginTop: 6,
    },
    tilePrice: {
      flexShrink: 1,
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    tilePriceDisabled: { color: c.textMuted },
    tileQty: {
      position: 'absolute',
      top: -8,
      right: -6,
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 6,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    tileQtyText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '900' },
    lowDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#F59E0B',
    },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: c.dangerSoft,
    },
    errorText: { flex: 1, color: c.danger, fontSize: 12, fontWeight: '600' },
    retry: { color: c.danger, fontSize: 12, fontWeight: '900' },
    emptyCart: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: 6,
      width: '100%',
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 6,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 20,
    },

    /* footer */
    footer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    footerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerKicker: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    footerTotal: {
      color: c.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    undoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    undoText: { color: c.textPrimary, fontSize: 14, fontWeight: '800' },
    payRow: { flexDirection: 'row', gap: 10 },
    payBtn: {
      flex: 1,
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 16,
    },
    payBtnMpesa: { backgroundColor: '#16A34A' },
    payBtnDisabled: { opacity: 0.4 },
    payBtnText: { color: '#fff', fontWeight: '900', fontSize: 17 },

    /* snackbar */
    snackbar: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    snackText: { flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: '800' },
    snackAction: { color: c.link, fontSize: 14, fontWeight: '900' },

    /* list rows reused inside modals */
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    resultName: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    resultMeta: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },

    /* sheets — shared across all modals */
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: 8,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 8,
    },
    sheetTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '900' },
    sheetTotal: {
      color: c.textPrimary,
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      marginBottom: 6,
    },
    sheetKicker: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.1,
      marginTop: 8,
      marginBottom: 6,
    },
    sheetInput: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: c.textPrimary,
      fontSize: 16,
    },
    methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    methodChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    methodChipDisabled: { opacity: 0.4 },
    methodText: { color: c.textPrimary, fontSize: 14, fontWeight: '800' },
    methodTextActive: { color: c.textOnPrimary },
    methodTextDisabled: { color: c.textMuted },
    quickChip: {
      minWidth: 70,
      height: 48,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    quickChipText: { color: c.link, fontSize: 16, fontWeight: '900' },
    changeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    changeLabel: { color: c.textMuted, fontSize: 14, fontWeight: '700' },
    changeValue: {
      color: c.success,
      fontSize: 26,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      backgroundColor: c.primary,
      paddingVertical: 16,
      borderRadius: 14,
    },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    secondaryBtnText: { color: c.link, fontSize: 14, fontWeight: '800' },
    walkinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      marginTop: 4,
    },
    walkinText: { color: c.link, fontSize: 14, fontWeight: '800' },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowGap: { flexDirection: 'row', gap: 10 },

    /* cart sheet */
    cartTotal: {
      color: c.textPrimary,
      fontSize: 20,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    cartRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    cartRowName: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    cartRowMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    cartRowTotal: {
      minWidth: 70,
      textAlign: 'right',
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    qtyBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
    },
    qtyText: {
      minWidth: 22,
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },

    /* variant picker */
    variantSub: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: -2,
      marginBottom: 6,
    },
    variantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    variantRowPressed: { opacity: 0.7 },
    variantRowDisabled: { opacity: 0.4 },
    variantName: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    variantMeta: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    variantPrice: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      marginRight: 4,
    },

    /* receipt */
    receiptHeader: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    receiptMeta: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
    },
    receiptRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 12,
    },
    receiptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      gap: 12,
    },
    receiptItem: { color: c.textPrimary, fontSize: 13, flexShrink: 1 },
    receiptAmount: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    receiptTotalLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '900' },
    receiptTotalValue: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    receiptFooter: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
    },
  });
}