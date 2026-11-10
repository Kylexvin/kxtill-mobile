// src/screens/pos/PosBarcodeScanner.jsx
//
// Inline barcode scanner for the POS. Opens the camera in a modal,
// scans one code, looks it up locally (server fallback), hands
// { product, unit } back to the caller, and closes.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing } from '../../styles/spacing';
import { lookupBarcode } from '../../offline/catalogue';
import { normalizeProduct } from './usePos';

const SCAN_COOLDOWN_MS = 1200;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_W = Math.min(SCREEN_W * 0.72, 320);
const FRAME_H = FRAME_W * 0.66;

const TOP_BAR_H = 56;
const BOTTOM_BAR_H = 72;

export default function PosBarcodeScanner({
  visible,
  onClose,
  orgId,
  branchId,
  onScanned,
  c,
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef({ value: null, at: 0 });
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setBusy(false);
      setStatus(null);
      setTorch(false);
      lastScanRef.current = { value: null, at: 0 };
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || busy) return undefined;
    scanAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, busy, scanAnim]);

  const handleScan = useCallback(
    async ({ data }) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last.value === data && now - last.at < SCAN_COOLDOWN_MS) return;
      lastScanRef.current = { value: data, at: now };

      if (!orgId || !branchId) {
        setStatus('error');
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        const hit = await lookupBarcode(orgId, branchId, data, normalizeProduct);
        if (!hit) {
          setStatus('not_found');
          setBusy(false);
          return;
        }
        onScanned?.(hit); // { product, unit }
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || '';
        if (/not found/i.test(msg)) setStatus('not_found');
        else if (!e?.response) setStatus('offline');
        else setStatus('error');
        setBusy(false);
      }
    },
    [orgId, branchId, onScanned]
  );

  if (!visible) return null;

  // Vertical center of the usable area (between top bar and bottom bar).
  const topBarBottom = insets.top + TOP_BAR_H;
  const bottomBarTop = SCREEN_H - (insets.bottom + BOTTOM_BAR_H);
  const usableCenterY = (topBarBottom + bottomBarTop) / 2;
  const frameTop = usableCenterY - FRAME_H / 2;
  const frameLeft = (SCREEN_W - FRAME_W) / 2;

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, FRAME_H - 8],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'qr',
              ],
            }}
            onBarcodeScanned={busy ? undefined : handleScan}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={32} color={c.textMuted} />
            <Text style={styles.permissionText}>
              Camera access is needed to scan barcodes.
            </Text>
            <Pressable onPress={requestPermission} style={styles.permissionBtn}>
              <Text style={styles.permissionBtnText}>Grant access</Text>
            </Pressable>
          </View>
        )}

        {/* Dim overlay: four panels around the cutout so the live camera
            feed shows through the scan window. */}
        {permission?.granted ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* top dim */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: frameTop,
                backgroundColor: 'rgba(0,0,0,0.42)',
              }}
            />
            {/* bottom dim */}
            <View
              style={{
                position: 'absolute',
                top: frameTop + FRAME_H,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.42)',
              }}
            />
            {/* left dim (middle band) */}
            <View
              style={{
                position: 'absolute',
                top: frameTop,
                left: 0,
                width: frameLeft,
                height: FRAME_H,
                backgroundColor: 'rgba(0,0,0,0.42)',
              }}
            />
            {/* right dim (middle band) */}
            <View
              style={{
                position: 'absolute',
                top: frameTop,
                left: frameLeft + FRAME_W,
                right: 0,
                height: FRAME_H,
                backgroundColor: 'rgba(0,0,0,0.42)',
              }}
            />

            {/* Cutout — no background, camera shows through. */}
            <View
              style={{
                position: 'absolute',
                top: frameTop,
                left: frameLeft,
                width: FRAME_W,
                height: FRAME_H,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {!busy ? (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineY }] },
                  ]}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.topBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>Scan barcode</Text>
          <Pressable
            onPress={() => setTorch((v) => !v)}
            hitSlop={12}
            style={[styles.topBtn, torch && styles.topBtnActive]}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-off'}
              size={20}
              color="#fff"
            />
          </Pressable>
        </View>

        {/* Bottom status */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {busy ? (
            <View style={styles.statusPill}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.statusText}>Looking up…</Text>
            </View>
          ) : status === 'not_found' ? (
            <View style={[styles.statusPill, styles.statusPillWarn]}>
              <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
              <Text style={styles.statusText}>
                Not found at this branch — try another code
              </Text>
            </View>
          ) : status === 'offline' ? (
            <View style={[styles.statusPill, styles.statusPillWarn]}>
              <Ionicons name="cloud-offline" size={16} color="#FCA5A5" />
              <Text style={styles.statusText}>
                Not in saved catalogue and no connection
              </Text>
            </View>
          ) : status === 'error' ? (
            <View style={[styles.statusPill, styles.statusPillWarn]}>
              <Ionicons name="warning" size={16} color="#FCA5A5" />
              <Text style={styles.statusText}>
                Could not look up product. Try again.
              </Text>
            </View>
          ) : (
            <View style={styles.statusPill}>
              <Ionicons name="scan-outline" size={16} color="#fff" />
              <Text style={styles.statusText}>
                Align the barcode in the frame
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  topTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },

  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 16,
  },

  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '100%',
  },
  statusPillWarn: { backgroundColor: 'rgba(127,29,29,0.75)' },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },

  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  permissionText: {
    color: '#E5E7EB',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: { color: '#111', fontWeight: '900' },
});