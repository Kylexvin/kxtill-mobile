// src/screens/pos/PosScreen.jsx

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
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
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { useSettings } from '../../context/SettingsContext';
import { usePermissionsContext } from '../../context/PermissionsContext';
import { KXTILL } from '../../constants/permissions';
import { BRAND_ICONS } from '../../constants/config';

const MPESA_GREEN = '#10B981';

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
import {
  PosPaymentModal,
  PosCartModal,
  PosHeldModal,
  PosShiftModal,
} from './PosSheets';
import PosBarcodeScanner from './PosBarcodeScanner';
import PosLoader from './PosLoader';
import * as outbox from '../../offline/outbox';
import { usePosMpesa } from './usePosMpesa';

const catLabel = (cat) =>
  !cat ? null : typeof cat === 'string' ? cat : cat.name || null;

export default function PosScreen() {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const {
    activeOrganization,
    activeBranch,
    branches,
    setActiveBranch,
    ready: orgReady,
  } = useOrganizationContext();
  const {
    formatCurrency,
    settings: orgSettings,
    loading: settingsLoading,
    error: settingsError,
    refreshSettings,
  } = useSettings();

  const {
    can,
    loading: permsLoading,
    error: permsError,
    permissions,
    refresh: refreshPermissions,
  } = usePermissionsContext();

  const canSell = can(KXTILL.SALES.CREATE);
  const permsNotReady =
    permsLoading || (!permsError && permissions.length === 0);

  const orgId = activeOrganization?.id ?? null;
  const branchId = route.params?.branchId ?? activeBranch?.id ?? null;

  const { gate, runGate, openShift, closeShift } = usePosGate({
    orgId,
    branchId,
    contextReady: orgReady,
  });
  const productsState = usePosProducts({
    orgId,
    branchId,
    enabled: gate.status === 'ready' && canSell,
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
  const mpesa = usePosMpesa(orgId);

  const [category, setCategory] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [method, setMethod] = useState('CASH');
  const [methodsFirst, setMethodsFirst] = useState(false);
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [lastSaleId, setLastSaleId] = useState(null);
  const [lastClientId, setLastClientId] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const [shiftModal, setShiftModal] = useState({
    open: false,
    mode: 'open',
    shiftId: null,
    shift: null,
  });
  const [shiftSubmitting, setShiftSubmitting] = useState(false);

  const counts = outbox.useOutboxCounts();

  useEffect(() => outbox.startWorker(), []);

  const syncStatus = counts.pending > 0 ? 'pending' : 'synced';

  const loaderSteps = useMemo(
    () => [
      { label: 'Checking access', done: !permsNotReady },
      { label: 'Loading till settings', done: !!orgSettings },
      { label: 'Preparing shift', done: gate.status !== 'loading' },
    ],
    [permsNotReady, orgSettings, gate.status]
  );

  useEffect(() => {
    if (!snackOpen) return undefined;
    const t = setTimeout(() => setSnackOpen(false), 5000);
    return () => clearTimeout(t);
  }, [snackOpen]);

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

  const openPayment = (m, withMethods = false) => {
    if (cartState.cart.length === 0) return;
    setMethod(m);
    setMethodsFirst(withMethods);
    setReference('');
    mpesa.reset();
    setPhone('');
    setPayOpen(true);
  };

  const confirmPayment = async (ref) => {
    try {
      const sale = await saleState.submitSale({
        method,
        reference: typeof ref === 'string' ? ref : reference,
      });
      setPayOpen(false);
      setLastSaleId(sale.id ?? null);
      setLastClientId(sale.clientSaleId ?? null);
      setSnackOpen(true);
      productsState.reload();
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

  const sendMpesaPrompt = async () => {
    const receipt = await mpesa.start({
      phone,
      amount: cartState.subtotal,
      referenceId: cartState.clientSaleIdRef.current,
    });
    if (receipt) {
      setReference(receipt);
      confirmPayment(receipt);
    }
  };

  const showLastReceipt = async () => {
    const id =
      lastSaleId ||
      (lastClientId ? await outbox.getSyncedSaleId(lastClientId) : null);
    if (!id) {
      Alert.alert('Receipt', 'Available once the sale has synced.');
      return;
    }
    receiptState.show(id);
  };

  const handleAdd = (item) => {
    const units = item.units || [];
    if (units.length > 1) {
      setVariantProduct(item);
      return;
    }
    cartState.addToCart(item, units[0] || item.baseUnit);
  };

  const handleBarcodeScanned = (hit) => {
    setScanOpen(false);
    if (!hit?.product) return;
    const { product, unit } = hit;
    if (!product.isAvailable) {
      Alert.alert('Unavailable', `${product.name} is not available.`);
      return;
    }
    cartState.addToCart(product, unit || product.baseUnit || product.units?.[0]);
  };

  const handleOpenShift = async (openingFloat) => {
    setShiftSubmitting(true);
    try {
      await openShift(openingFloat);
      setShiftModal({ open: false, mode: 'open', shiftId: null, shift: null });
    } catch (e) {
      Alert.alert(
        'Open failed',
        e?.response?.data?.error || e?.message || 'Could not open shift'
      );
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCloseShift = async (declaredCash) => {
    if (!shiftModal.shiftId) return;
    setShiftSubmitting(true);
    try {
      const closed = await closeShift(shiftModal.shiftId, declaredCash);
      setShiftModal({ open: false, mode: 'open', shiftId: null, shift: null });
      const variance =
        closed?.variance != null ? Number(closed.variance) : null;
      if (variance != null && variance !== 0) {
        Alert.alert(
          'Shift closed',
          variance > 0
            ? `Overage: ${formatCurrency(Math.abs(variance))}`
            : `Shortage: ${formatCurrency(Math.abs(variance))}`
        );
      }
    } catch (e) {
      Alert.alert(
        'Close failed',
        e?.response?.data?.error || e?.message || 'Could not close shift'
      );
    } finally {
      setShiftSubmitting(false);
    }
  };

  const openShiftModal = (mode, shift = null) => {
    setShiftModal({
      open: true,
      mode,
      shiftId: shift?.id ?? null,
      shift,
    });
  };

  if (permsNotReady) {
    return (
      <SafeAreaView style={styles.center}>
        <PosLoader steps={loaderSteps} logo={BRAND_ICONS.kxtill} c={c} />
      </SafeAreaView>
    );
  }

  if (permsError && permissions.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={28} color={c.danger} />
        <Text style={styles.centerTitle}>Couldn't verify access</Text>
        <Text style={styles.centerText}>{permsError}</Text>
        <Pressable onPress={refreshPermissions} style={styles.centerBtn}>
          <Text style={styles.centerBtnText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!canSell) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="lock-closed-outline" size={28} color={c.link} />
        <Text style={styles.centerTitle}>POS not available</Text>
        <Text style={styles.centerText}>
          You don't have permission to create sales. Ask an admin to grant you
          access.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerBtn}>
          <Text style={styles.centerBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!orgSettings && settingsLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <PosLoader steps={loaderSteps} logo={BRAND_ICONS.kxtill} c={c} />
      </SafeAreaView>
    );
  }

  if (!orgSettings) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="settings-outline" size={28} color={c.danger} />
        <Text style={styles.centerTitle}>Till settings unavailable</Text>
        <Text style={styles.centerText}>
          This till needs to load its currency, tax number and receipt details
          once before it can sell. Connect to the internet and try again.
        </Text>
        {settingsError ? (
          <Text style={[styles.centerText, { color: c.danger }]}>
            {settingsError}
          </Text>
        ) : null}
        <Pressable onPress={refreshSettings} style={styles.centerBtn}>
          <Text style={styles.centerBtnText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (gate.status === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <PosLoader steps={loaderSteps} logo={BRAND_ICONS.kxtill} c={c} />
      </SafeAreaView>
    );
  }

  if (gate.status === 'blocked') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
        <Text style={styles.centerTitle}>Shift conflict</Text>
        <Text style={styles.centerText}>{gate.error}</Text>
        <Pressable
          onPress={() => openShiftModal('blocked-close', gate.blockedShift)}
          style={styles.centerBtn}
        >
          <Text style={styles.centerBtnText}>Close that shift</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Cancel</Text>
        </Pressable>
        <PosShiftModal
          visible={shiftModal.open}
          mode="blocked-close"
          shift={shiftModal.shift}
          submitting={shiftSubmitting}
          onClose={() =>
            setShiftModal({ open: false, mode: 'open', shiftId: null, shift: null })
          }
          onCloseShift={handleCloseShift}
          formatCurrency={formatCurrency}
          c={c}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  if (gate.status === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={28} color={c.danger} />
        <Text style={styles.centerTitle}>POS unavailable</Text>
        <Text style={styles.centerText}>{gate.error}</Text>
        <Pressable onPress={runGate} style={styles.centerBtn}>
          <Text style={styles.centerBtnText}>Retry</Text>
        </Pressable>
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
        <Pressable
          onPress={() => openShiftModal('open')}
          style={styles.centerBtn}
        >
          <Text style={styles.centerBtnText}>Open shift</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Cancel</Text>
        </Pressable>
        <PosShiftModal
          visible={shiftModal.open}
          mode="open"
          branchName={activeBranch?.name}
          submitting={shiftSubmitting}
          onClose={() =>
            setShiftModal({ open: false, mode: 'open', shiftId: null, shift: null })
          }
          onOpenShift={handleOpenShift}
          formatCurrency={formatCurrency}
          c={c}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  if (gate.status === 'no-branch') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="business-outline" size={28} color={c.link} />
        <Text style={styles.centerTitle}>Choose a branch</Text>
        <Text style={styles.centerText}>
          This organization has more than one branch. Pick one to start selling.
        </Text>
        {branches.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => setActiveBranch(b)}
            style={styles.centerBtn}
          >
            <Text style={styles.centerBtnText}>{b.name}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => navigation.goBack()} style={styles.centerLink}>
          <Text style={styles.centerLinkText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const cartEmpty = cartState.cart.length === 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <PosHeader
          syncStatus={syncStatus}
          pendingCount={counts.pending}
          heldCount={cartState.held.length}
          totalQty={cartState.totalQty}
          subtotal={cartState.subtotal}
          onScan={() => setScanOpen(true)}
          onHeld={() => setHeldOpen(true)}
          onCart={() => setCartOpen(true)}
          onCloseShift={
            gate.shift ? () => openShiftModal('close', gate.shift) : undefined
          }
          formatCurrency={formatCurrency}
          c={c}
          styles={styles}
        />
      </SafeAreaView>

      <View style={styles.bodyWrap}>
        <PosSearchBar
          query={productsState.query}
          setQuery={productsState.setQuery}
          c={c}
          styles={styles}
        />

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
            loadedOnce={productsState.loadedOnce}
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
            onReceipt={showLastReceipt}
            c={c}
            styles={styles}
          />
        </View>
      </View>

      <PosFooter
        totalQty={cartState.totalQty}
        subtotal={cartState.subtotal}
        cartEmpty={cartEmpty}
        onPayCash={() => openPayment('CASH')}
        onPayMpesa={() => openPayment('MPESA')}
        onCloseShift={
          gate.shift ? () => openShiftModal('close', gate.shift) : undefined
        }
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
        mpesa={mpesa}
        phone={phone}
        setPhone={setPhone}
        onSendPrompt={sendMpesaPrompt}
        onCancelPrompt={mpesa.reset}
        startWithMethods={methodsFirst}
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

      <PosBarcodeScanner
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        orgId={orgId}
        branchId={branchId}
        onScanned={handleBarcodeScanned}
        c={c}
      />

      <PosShiftModal
        visible={shiftModal.open}
        mode={shiftModal.mode}
        shift={shiftModal.shift || gate.shift}
        branchName={activeBranch?.name}
        submitting={shiftSubmitting}
        onClose={() =>
          setShiftModal({ open: false, mode: 'open', shiftId: null, shift: null })
        }
        onOpenShift={handleOpenShift}
        onCloseShift={handleCloseShift}
        formatCurrency={formatCurrency}
        c={c}
        styles={styles}
      />
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    safeTop: { backgroundColor: c.primary },
    bodyWrap: { flex: 1, backgroundColor: c.background },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: spacing.xl,
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
      borderRadius: radius.md,
    },
    centerBtnText: { color: c.textOnPrimary, fontWeight: '800' },
    centerLink: { marginTop: 6 },
    centerLinkText: { color: c.link, fontWeight: '700' },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: c.primary,
    },
    shiftSub: {
      color: c.textOnPrimary,
      opacity: 0.85,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      marginBottom: 6,
    },
    brandWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 4,
    },
    markWrap: { justifyContent: 'center' },
    logoTile: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: { width: 32, height: 32 },
    brandDivider: {
      width: 1,
      height: 28,
      backgroundColor: c.textOnPrimary,
      opacity: 0.35,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: {
      color: c.textOnPrimary,
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
    },
    headerActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    actionWrap: { alignItems: 'center', minWidth: 48 },
    actionBtn: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: c.primary,
      borderWidth: 1.5,
      borderColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBadgeText: {
      color: c.textOnPrimary,
      fontSize: 11,
      fontWeight: '900',
    },
    actionLabel: {
      color: c.textOnPrimary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 4,
    },

    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    searchBox: {
      flex: 1,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 15,
      padding: 0,
    },

    chipsWrap: { paddingBottom: 8 },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    catChipActive: { borderColor: c.primary, borderWidth: 1.5 },
    catChipText: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
    catChipTextActive: { color: c.primary },

    gridContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: 12,
      flexGrow: 1,
    },
    gridCenter: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    gridRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
      marginTop: 8,
    },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

tile: {
  width: '31.5%',
  aspectRatio: 0.85,
  backgroundColor: c.surface,
  borderWidth: 1,
  borderColor: c.border,
  borderRadius: radius.lg,
  padding: 10,
  justifyContent: 'space-between',
  shadowColor: c.shadow || '#000',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
},
    tileSkeleton: {
      backgroundColor: c.surfaceElevated,
      borderColor: c.border,
    },
    skName: {
      height: 13,
      borderRadius: 4,
      backgroundColor: c.border,
      width: '80%',
      marginTop: 6,
    },
    skNameShort: {
      height: 13,
      borderRadius: 4,
      backgroundColor: c.border,
      width: '55%',
      marginTop: 6,
    },
    skPrice: {
      height: 14,
      borderRadius: 4,
      backgroundColor: c.border,
      width: '60%',
    },
    skStock: {
      height: 10,
      borderRadius: 3,
      backgroundColor: c.border,
      width: '45%',
    },
    tileActive: {
      borderColor: c.primary,
      borderWidth: 2,
      backgroundColor: c.primarySoft,
    },
    tilePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    tileDisabled: { opacity: 0.5, backgroundColor: c.background },

    tileQty: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      borderWidth: 2,
      borderColor: c.surface,
    },
    tileQtyText: { color: c.textOnPrimary, fontSize: 11, fontWeight: '900' },

    lowStockBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: c.dangerSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    lowStockText: { color: c.danger, fontSize: 9, fontWeight: '900' },

    tileName: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 16,
      marginTop: 6,
    },
    tileNameDisabled: {
      color: c.textMuted,
      textDecorationLine: 'line-through',
    },

    tileBottom: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    tilePrice: {
      flexShrink: 1,
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    tilePriceDisabled: { color: c.textMuted, fontSize: 12 },

    tileStock: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },
    tileStockLow: { color: c.danger, fontWeight: '800' },

    unitBadge: {
      backgroundColor: c.surfaceElevated,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    unitBadgeText: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
    },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 8,
      borderRadius: radius.md,
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
    },

    snackbar: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    snackText: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    snackAction: { color: c.link, fontSize: 13, fontWeight: '900' },

    footerWrapper: {
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    footer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      backgroundColor: c.surface,
      gap: 12,
    },
    footerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerKicker: {
      color: c.textMuted,
      fontSize: 15,
      fontWeight: '700',
    },
    footerTotal: {
      color: c.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    payRow: { flexDirection: 'row', gap: 8 },
    payBtn: {
      flex: 1,
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.primary,
      borderRadius: 18,
    },
    payBtnMpesa: { backgroundColor: MPESA_GREEN },
    payBtnDisabled: { opacity: 0.5 },
    payBtnText: {
      color: c.textOnPrimary,
      fontWeight: '900',
      fontSize: 19,
    },
    payOther: {
      flex: 1,
      minWidth: 44,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },

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
    sheetTitle: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    sheetTotal: {
      color: c.textPrimary,
      fontSize: 30,
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
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.textPrimary,
      fontSize: 15,
    },
    methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    methodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    methodChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    methodChipDisabled: { opacity: 0.4 },
    methodText: { color: c.textPrimary, fontSize: 13, fontWeight: '800' },
    methodTextActive: { color: c.textOnPrimary },
    methodTextDisabled: { color: c.textMuted },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    quickChipText: { color: c.textPrimary, fontSize: 12, fontWeight: '800' },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: 4,
    },
    changeLabel: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    changeValue: {
      color: c.primary,
      fontSize: 20,
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
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    confirmText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '900' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: radius.md,
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

    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
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
      paddingVertical: 12,
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

    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowGap: { flexDirection: 'row', gap: 8 },
    cartTotal: {
      color: c.textPrimary,
      fontSize: 18,
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
    cartRowName: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    cartRowMeta: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    cartRowTotal: {
      minWidth: 70,
      textAlign: 'right',
      color: c.textPrimary,
      fontWeight: '900',
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    qtyBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
    },
    qtyText: {
      minWidth: 22,
      textAlign: 'center',
      color: c.textPrimary,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },

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
    receiptTotalLabel: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
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
    brandName: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: -0.3,
    },

    /* ── M-Pesa waiting / success ────────────────────────────── */
    mpesaWaiting: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 24,
      paddingHorizontal: 8,
    },
    mpesaPulseWrap: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    mpesaPulseRing: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 2,
    },
    mpesaPulseCore: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mpesaWaitTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 6,
    },
    mpesaWaitHint: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    mpesaCancelBtn: {
      marginTop: 6,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    mpesaCancelText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },

    mpesaSuccess: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 24,
    },
    mpesaSuccessIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    mpesaSuccessTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    mpesaSuccessSub: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    mpesaCodePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: c.primarySoft,
      marginTop: 4,
    },
    mpesaCodeText: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
  });