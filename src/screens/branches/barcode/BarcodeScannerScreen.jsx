// src/screens/branches/barcode/BarcodeScannerScreen.jsx
//
// Barcode scanner — camera stays mounted; result slides up as a bottom sheet.
// Hit:  product name, SKU/category, barcode, stock + price, View product / Scan another.
// Miss: "Unknown barcode" + Add product (prefills barcode).
//
// Uses only modules already in the binary (expo-camera, expo-haptics).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { useOrganizationContext } from '../../../context/OrganizationContext';
import { useSettings } from '../../../context/SettingsContext';
import { ROUTES } from '../../../constants/routes';
import { api } from '../../../services/api';

const SCAN_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
];

const BRAND = '#F04000';
const FRAME_W = 280;
const FRAME_H = 180;
const CORNER = 34;
const SHEET_OFFSET = 640;
// expo-camera scans the WHOLE preview. With the frame visually centered on
// screen but bounds relative to the camera box, strict region checking
// rejects valid scans. Keep false for reliability.
const STRICT_REGION = false;

/* ── helpers ──────────────────────────────────────────────── */

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {}
  );
}
function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => {}
  );
}

function fmtBarcode(code) {
  if (!code) return '';
  const s = String(code);
  if (s.length === 13) return `${s.slice(0, 1)} ${s.slice(1, 7)} ${s.slice(7)}`;
  if (s.length === 12) return `${s.slice(0, 1)} ${s.slice(1, 6)} ${s.slice(6)}`;
  if (s.length === 8) return `${s.slice(0, 4)} ${s.slice(4)}`;
  return s;
}

/* ── scan line ─────────────────────────────────────────────── */

function ScanLine({ active, color }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      y.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, y]);

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        top: 0,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        transform: [
          {
            translateY: y.interpolate({
              inputRange: [0, 1],
              outputRange: [10, FRAME_H - 12],
            }),
          },
        ],
      }}
    />
  );
}

/* ── corner brackets ───────────────────────────────────────── */

function Corners({ color }) {
  const base = {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: color,
  };
  return (
    <>
      <View
        style={[
          base,
          {
            top: 0,
            left: 0,
            borderTopWidth: 4,
            borderLeftWidth: 4,
            borderTopLeftRadius: 16,
          },
        ]}
      />
      <View
        style={[
          base,
          {
            top: 0,
            right: 0,
            borderTopWidth: 4,
            borderRightWidth: 4,
            borderTopRightRadius: 16,
          },
        ]}
      />
      <View
        style={[
          base,
          {
            bottom: 0,
            left: 0,
            borderBottomWidth: 4,
            borderLeftWidth: 4,
            borderBottomLeftRadius: 16,
          },
        ]}
      />
      <View
        style={[
          base,
          {
            bottom: 0,
            right: 0,
            borderBottomWidth: 4,
            borderRightWidth: 4,
            borderBottomRightRadius: 16,
          },
        ]}
      />
    </>
  );
}

/* ── screen ────────────────────────────────────────────────── */

export default function BarcodeScannerScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { activeOrganization, activeBranch } = useOrganizationContext();
  const { formatCurrency } = useSettings();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedCode, setScannedCode] = useState(null);
  const [lookupState, setLookupState] = useState('idle'); // idle | loading | hit | miss | error
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [torch, setTorch] = useState(false);
  const [cam, setCam] = useState({ w: 0, h: 0 });

  const lockRef = useRef(false);
  const sheetY = useRef(new Animated.Value(SHEET_OFFSET)).current;

  const showResult =
    lookupState === 'hit' || lookupState === 'miss' || lookupState === 'error';
  const isHit = lookupState === 'hit';

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  // Slide the sheet in/out with the result state.
  useEffect(() => {
    Animated.spring(sheetY, {
      toValue: showResult ? 0 : SHEET_OFFSET,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [showResult, sheetY]);

  const reset = useCallback(() => {
    lockRef.current = false;
    setScanned(false);
    setScannedCode(null);
    setLookupState('idle');
    setProduct(null);
    setError(null);
    setManualMode(false);
    setManualCode('');
  }, []);

  const lookup = useCallback(
    async (code) => {
      if (!activeOrganization?.id) return;
      setScanned(true);
      setScannedCode(code);
      setLookupState('loading');
      setError(null);

      try {
        const params = {};
        if (activeBranch?.id) params.branchId = activeBranch.id;

        const { data } = await api.get(
          `/api/v1/organizations/${activeOrganization.id}/kxtill/products/barcode/${encodeURIComponent(
            code
          )}`,
          { params }
        );

        const p = data?.product || null;
        if (p) {
          setProduct(p);
          setLookupState('hit');
          hapticSuccess();
        } else {
          setLookupState('miss');
          hapticWarning();
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          setLookupState('miss');
          hapticWarning();
        } else {
          setLookupState('error');
          hapticWarning();
          setError(
            e?.response?.data?.error ||
              e?.response?.data?.message ||
              e?.message ||
              'Lookup failed'
          );
        }
      }
    },
    [activeOrganization?.id, activeBranch?.id]
  );

  const handleScan = useCallback(
    ({ data, bounds }) => {
      if (lockRef.current) return;

      // Region check disabled (STRICT_REGION=false). If re-enabled, bounds
      // are relative to cameraWrap, not the screen overlay.
      if (STRICT_REGION && bounds?.origin && bounds?.size && cam.w && cam.h) {
        const cx = bounds.origin.x + bounds.size.width / 2;
        const cy = bounds.origin.y + bounds.size.height / 2;
        const left = (cam.w - FRAME_W) / 2;
        const top = (cam.h - FRAME_H) / 2;
        const pad = 24;
        const inside =
          cx >= left - pad &&
          cx <= left + FRAME_W + pad &&
          cy >= top - pad &&
          cy <= top + FRAME_H + pad;
        if (!inside) return;
      }

      lockRef.current = true;
      const code = String(data || '').trim();
      if (!code) {
        lockRef.current = false;
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      lookup(code);
    },
    [lookup, cam.w, cam.h]
  );

  const onManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    lockRef.current = true;
    setManualMode(false);
    lookup(code);
  };

  const matchedUnit = useMemo(() => {
    if (!product || !scannedCode) return null;
    const units = Array.isArray(product.units) ? product.units : [];
    return (
      units.find((u) => String(u.barcode) === String(scannedCode)) ||
      product.baseUnit ||
      null
    );
  }, [product, scannedCode]);

  const onAddProduct = () => {
    navigation.navigate(ROUTES.PRODUCT_FORM, {
      mode: 'create',
      initialBarcode: scannedCode,
    });
    reset();
  };

  const onViewProduct = () => {
    if (!product) return;
    navigation.navigate(ROUTES.PRODUCT_DETAIL, {
      productId: product.id,
      product,
    });
    reset();
  };

  /* ── permission gates ────────────────────────────────────── */

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan barcode</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={44} color={c.textMuted} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            KxTill needs camera access to scan barcodes.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── camera + sheet ──────────────────────────────────────── */

  const bracketColor = !showResult
    ? BRAND
    : isHit
      ? c.success
      : c.danger;

  return (
    <View style={styles.root}>
      {/* top bar (in flow, not over the camera) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.overlayIcon}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Scan barcode</Text>
        <Pressable
          onPress={() => setTorch((t) => !t)}
          hitSlop={10}
          style={[styles.overlayIcon, torch && { backgroundColor: BRAND }]}
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
        >
          <Ionicons
            name={torch ? 'flash' : 'flash-outline'}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      {/* camera card */}
      <View
        style={styles.cameraWrap}
        onLayout={(e) =>
          setCam({
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }
      >
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="on"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: SCAN_TYPES }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />

        {scanned ? (
          <View
            pointerEvents="none"
            style={[
              styles.dim,
              {
                backgroundColor: showResult
                  ? 'rgba(0,0,0,0.62)'
                  : 'rgba(0,0,0,0.35)',
              },
            ]}
          />
        ) : null}
      </View>

      {/* Frame overlay — centered on the whole screen */}
      <View pointerEvents="none" style={styles.frameOverlay}>
        <View style={styles.scanFrame}>
          <Corners color={bracketColor} />
          <ScanLine active={!scanned} color={BRAND} />
        </View>
        {!showResult ? (
          <View style={styles.hintPill}>
            {lookupState === 'loading' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : null}
            <Text style={styles.scanHint}>
              {lookupState === 'loading' ? 'Looking up…' : 'Point at a barcode'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* manual-entry dock (in flow, sheet covers it on result) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.dockWrap, { paddingBottom: insets.bottom + 16 }]}
      >
        {manualMode ? (
          <View style={styles.dock}>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Enter barcode"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              autoFocus
              style={styles.manualInput}
              onSubmitEditing={onManualSubmit}
            />
            <Pressable
              style={styles.dockGo}
              onPress={onManualSubmit}
              accessibilityRole="button"
              accessibilityLabel="Look up"
            >
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.dockCancel}
              onPress={() => {
                setManualMode(false);
                setManualCode('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.dock}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dockTitle}>Can’t scan it?</Text>
              <Text style={styles.dockSub}>Type the code instead</Text>
            </View>
            <Pressable
              style={styles.dockBtn}
              onPress={() => setManualMode(true)}
              accessibilityRole="button"
            >
              <Ionicons name="keypad-outline" size={16} color="#FFFFFF" />
              <Text style={styles.dockBtnText}>Enter code</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* result sheet */}
      <Animated.View
        pointerEvents={showResult ? 'auto' : 'none'}
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY: sheetY }],
          },
        ]}
      >
        <View style={styles.grabber} />

        <View style={styles.sheetTop}>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: isHit ? c.primarySoft : c.dangerSoft },
            ]}
          >
            <Ionicons
              name={isHit ? 'checkmark-circle' : 'alert-circle'}
              size={12}
              color={isHit ? c.success : c.danger}
            />
            <Text
              style={[
                styles.statusText,
                { color: isHit ? c.primary : c.danger },
              ]}
            >
              {isHit ? 'Found' : 'Not found'}
            </Text>
          </View>
        </View>

        <Text style={styles.sheetName} numberOfLines={2}>
          {isHit && product ? product.name : 'Unknown barcode'}
        </Text>
        <Text style={styles.sheetSub} numberOfLines={2}>
          {isHit && product
            ? `${product.sku ? product.sku + ' · ' : ''}${
                product.category || 'Product'
              }`
            : error || 'No product matches this code yet.'}
        </Text>

        <View style={styles.barcodePill}>
          <Ionicons name="barcode-outline" size={16} color={c.link} />
          <Text style={styles.barcodeText} numberOfLines={1}>
            {fmtBarcode(scannedCode)}
          </Text>
        </View>

        {isHit && product ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>STOCK</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {product.stock ?? '—'}
                  {matchedUnit?.abbreviation
                    ? ` ${matchedUnit.abbreviation}`
                    : ''}
                </Text>
              </View>
              <View style={[styles.stat, styles.statDivider]}>
                <Text style={styles.statLabel}>PRICE</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {formatCurrency(Number(matchedUnit?.price || 0))}
                </Text>
              </View>
            </View>
            {matchedUnit?.name ? (
              <Text style={styles.unitNote} numberOfLines={1}>
                Matched unit: {matchedUnit.name}
              </Text>
            ) : null}

            <Pressable style={styles.primaryBtn} onPress={onViewProduct}>
              <Ionicons name="cube-outline" size={18} color={c.textOnPrimary} />
              <Text style={styles.primaryBtnText}>View product</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.missNote}>
              Add it now and the barcode is filled in for you.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={onAddProduct}>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={c.textOnPrimary}
              />
              <Text style={styles.primaryBtnText}>Add product</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.secondaryBtn} onPress={reset}>
          <Text style={styles.secondaryBtnText}>Scan another</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────────── */

const makeStyles = (c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    safe: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    permTitle: { ...typography.h3, color: c.textPrimary, marginTop: spacing.md },
    permBody: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },

    // Permission-state header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '800' },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Camera overlays
    dim: { ...StyleSheet.absoluteFillObject },
    cameraWrap: {
      flex: 1,
      marginHorizontal: spacing.md,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    topBar: {
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    topTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    overlayIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Frame overlay — centered on the screen
    frameOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 80, // nudge up so it sits between top bar and dock
    },
    scanFrame: { width: FRAME_W, height: FRAME_H },
    hintPill: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    scanHint: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

    // Manual-entry dock
    dockWrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
    },
    dock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 64,
      paddingVertical: 8,
      paddingLeft: 22,
      paddingRight: 8,
      borderRadius: 32,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    dockTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
    dockSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    dockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 48,
      paddingHorizontal: 18,
      borderRadius: 24,
      backgroundColor: BRAND,
    },
    dockBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    manualInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1,
      paddingVertical: 10,
    },
    dockGo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: BRAND,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dockCancel: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Result sheet
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.xl,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -8 },
      elevation: 16,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: spacing.lg,
    },
    sheetTop: { flexDirection: 'row', alignItems: 'center' },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
    sheetName: {
      color: c.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.8,
      marginTop: 14,
    },
    sheetSub: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 4,
      lineHeight: 19,
    },
    barcodePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: spacing.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
    },
    barcodeText: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
    statRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: spacing.lg,
    },
    stat: { flex: 1, paddingHorizontal: spacing.lg },
    statDivider: { borderLeftWidth: 1, borderLeftColor: c.border },
    statLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    statValue: {
      ...typography.h3,
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    unitNote: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.sm,
    },
    missNote: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: spacing.md,
    },

    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: c.primary,
      marginTop: spacing.lg,
    },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    secondaryBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: spacing.sm,
    },
    secondaryBtnText: {
      color: c.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
  });