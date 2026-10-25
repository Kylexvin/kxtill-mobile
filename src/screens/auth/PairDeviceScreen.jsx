// src/screens/auth/PairDeviceScreen.jsx
//
// First-launch device pairing.
//
// v4 — header rebuilt to match Login / SelectOrganization / SelectBranch:
//   - Brand row (logo + "KxTill / by KXBYTE") at the top.
//   - "Back to sign in" text link on the right of the brand row.
//   - Kicker + title + one-line subtitle, spaced like the other auth screens.
//   - The precise instruction ("POS top bar → Connect phone") lives inside
//     the viewfinder as a hint chip, not in the header.
//
// Camera is a compact 3:4 viewfinder. Frame is anchored in the upper
// portion. Haptics + corner pulse + scan line + success ripple preserved.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { BRAND_ICONS } from '../../constants/config';

/* ── haptics ──────────────────────────────────────────────────── */

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
function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/* ── corner breathing ────────────────────────────────────────── */

function useAimPulse(active) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return pulse;
}

/* ── scan line ───────────────────────────────────────────────── */

function ScanLine({ active, color, height }) {
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
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, y]);

  if (!active) return null;

  const translateY = y.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, height - 20)],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: 8,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        opacity: 0.85,
        transform: [{ translateY }],
      }}
    />
  );
}

/* ── success ripple ──────────────────────────────────────────── */

function SuccessRipple({ active, color, size }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, grow]);

  if (!active) return null;

  const scale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] });
  const opacity = grow.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.6, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: 26,
        borderWidth: 3,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/* ── brand row ───────────────────────────────────────────────── */

function BrandRow({ c, styles, onBackToLogin }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLeft}>
        <View style={styles.logoChip}>
          <Image
            source={BRAND_ICONS.kxtill}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={styles.brandName}>KxTill</Text>
          <Text style={styles.brandBy}>by KXBYTE</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onBackToLogin}
        hitSlop={8}
        style={styles.backLink}
        activeOpacity={0.75}
      >
        <Ionicons name="arrow-back" size={14} color={c.primary} />
        <Text style={styles.backLinkText}>Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── screen ──────────────────────────────────────────────────── */

export default function PairDeviceScreen() {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  const navigation = useNavigation();
  const { signInWithPairing } = useAuth();
  const { width } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmToken, setConfirmToken] = useState(null);
  const [success, setSuccess] = useState(false);

  const lockRef = useRef(false);
  const aimPulse = useAimPulse(!scanned && !confirmToken && !error && !success);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  const reset = () => {
    lockRef.current = false;
    setScanned(false);
    setError(null);
    setConfirmToken(null);
    setBusy(false);
    setSuccess(false);
  };

  const handleBarCodeScanned = useCallback(({ data }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    const trimmed = String(data || '').trim();
    if (!trimmed) {
      hapticWarning();
      setError('Empty QR code');
      lockRef.current = false;
      return;
    }
    hapticSuccess();
    setScanned(true);
    setConfirmToken(trimmed);
  }, []);

  const confirmRedeem = async () => {
    if (!confirmToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPairing(confirmToken);
      hapticHeavy();
      setSuccess(true);
    } catch (e) {
      hapticWarning();
      const code = e?.response?.data?.code;
      const message =
        code === 'INVALID_TOKEN'
          ? 'This is not a KxTill pairing code.'
          : code === 'EXPIRED'
            ? 'This QR has expired. Generate a new one from the POS top bar.'
            : code === 'ALREADY_USED'
              ? 'This pairing code has already been used.'
              : code === 'REVOKED'
                ? 'This pairing was revoked.'
                : e?.response?.data?.message ||
                  e?.message ||
                  'Could not complete pairing.';
      setError(message);
      setConfirmToken(null);
      setScanned(false);
      lockRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  const goManualLogin = () => {
    navigation.navigate(ROUTES.LOGIN);
  };

  const statusText = success
    ? 'Connected. Signing you in…'
    : busy
      ? 'Connecting…'
      : error
        ? error
        : scanned
          ? 'QR found'
          : 'Scanning…';

  const statusColor = success
    ? c.success
    : busy || !error
      ? c.primary
      : c.danger;

  /* ── permission states ─────────────────────────────── */

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <BrandRow c={c} styles={styles} onBackToLogin={goManualLogin} />
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>CONNECT</Text>
            <Text style={styles.title}>Connect to your business.</Text>
            <Text style={styles.subtitle}>
              Scan the QR code from your KxTill POS.
            </Text>
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <BrandRow c={c} styles={styles} onBackToLogin={goManualLogin} />
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>CONNECT</Text>
            <Text style={styles.title}>Connect to your business.</Text>
            <Text style={styles.subtitle}>
              Scan the QR code from your KxTill POS.
            </Text>
          </View>
        </View>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={44} color={c.textMuted} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            To scan the QR code, KxTill Mobile needs access to your camera.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Allow camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goManualLogin}
            style={styles.linkWrap}
            hitSlop={8}
          >
            <Text style={styles.link}>Sign in with password instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── scanner ──────────────────────────────────────── */

  const cameraWidth = Math.min(width - spacing.xl * 2, 340);
  const cameraHeight = Math.round((cameraWidth * 4) / 3);
  const frameSize = 200;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <BrandRow c={c} styles={styles} onBackToLogin={goManualLogin} />

        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>CONNECT</Text>
          <Text style={styles.title}>Scan to connect.</Text>
          <Text style={styles.subtitle}>
            Point your camera at the QR code in your POS top bar.
          </Text>
        </View>
      </View>

      <View style={styles.viewfinderWrap}>
        <View
          style={[
            styles.viewfinder,
            { width: cameraWidth, height: cameraHeight },
          ]}
        >
          {!scanned && !success ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
          ) : null}

          {(scanned || success) && (
            <View pointerEvents="none" style={styles.frozenOverlay} />
          )}

          <View pointerEvents="none" style={styles.frameContainer}>
            <View style={{ width: frameSize, height: frameSize }}>
              {[
                styles.cornerTL,
                styles.cornerTR,
                styles.cornerBL,
                styles.cornerBR,
              ].map((cornerStyle, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.corner,
                    cornerStyle,
                    {
                      opacity: aimPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 1],
                      }),
                    },
                    error && { borderColor: c.danger },
                    success && { borderColor: c.success },
                  ]}
                />
              ))}

              <ScanLine
                active={!scanned && !success && !error}
                color={c.primary}
                height={frameSize}
              />
              <SuccessRipple
                active={success}
                color={c.success}
                size={frameSize}
              />
            </View>
          </View>

          <View pointerEvents="none" style={styles.hintChip}>
            <Ionicons
              name="qr-code-outline"
              size={13}
              color="#FFFFFF"
            />
            <Text style={styles.hintText} numberOfLines={1}>
              POS top bar → Connect phone
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColor,
              opacity: busy && !success ? 0.6 : 1,
            },
          ]}
        />
        <Text
          style={[styles.statusText, { color: statusColor }]}
          numberOfLines={2}
        >
          {statusText}
        </Text>
      </View>

      <View style={styles.actions}>
        {error ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={reset}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={16} color={c.textPrimary} />
            <Text style={styles.secondaryText}>Try again</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={goManualLogin}
          style={styles.linkWrap}
          hitSlop={8}
        >
          <Text style={styles.link}>Sign in with password instead</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!confirmToken && !busy}
        transparent
        animationType="slide"
        onRequestClose={reset}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetIconRow}>
              <View style={styles.sheetIcon}>
                <Ionicons
                  name="qr-code-outline"
                  size={22}
                  color={c.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Connect this phone?</Text>
                <Text style={styles.sheetToken} numberOfLines={1}>
                  {confirmToken
                    ? `${confirmToken.slice(0, 8)}…${confirmToken.slice(-4)}`
                    : ''}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetBody}>
              This will sign you in to the account that generated the QR on
              your POS.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={confirmRedeem}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={reset}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── styles ──────────────────────────────────────────────────── */

const CORNER = 26;
const BORDER = 3;

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },

    // Brand row — matches Login / SelectOrganization / SelectBranch
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    brandLeft: { flexDirection: 'row', alignItems: 'center' },
    logoChip: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    brandLogo: { width: 24, height: 24 },
    brandName: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 16,
      letterSpacing: -0.2,
    },
    brandBy: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 1,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: c.primarySoft,
    },
    backLinkText: {
      ...typography.caption,
      color: c.primary,
      fontWeight: '800',
      fontSize: 12,
    },

    // Title block
    titleBlock: {},
    kicker: {
      ...typography.label,
      color: c.primary,
      letterSpacing: 1.6,
      marginBottom: spacing.xs,
    },
    title: {
      ...typography.h1,
      color: c.textPrimary,
      letterSpacing: -0.6,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginTop: spacing.sm,
      lineHeight: 22,
    },

    // Viewfinder
    viewfinderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    viewfinder: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    frozenOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    frameContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      paddingTop: 24,
    },
    corner: {
      position: 'absolute',
      width: CORNER,
      height: CORNER,
      borderColor: c.primary,
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: BORDER,
      borderLeftWidth: BORDER,
      borderTopLeftRadius: 20,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: BORDER,
      borderRightWidth: BORDER,
      borderTopRightRadius: 20,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: BORDER,
      borderLeftWidth: BORDER,
      borderBottomLeftRadius: 20,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: BORDER,
      borderRightWidth: BORDER,
      borderBottomRightRadius: 20,
    },
    hintChip: {
      position: 'absolute',
      left: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    hintText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // Status strip
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    statusText: {
      ...typography.caption,
      fontWeight: '700',
      textAlign: 'center',
      maxWidth: 280,
    },

    // Actions
    actions: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },

    // Permission state
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    permTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.md,
    },
    permBody: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
      lineHeight: 22,
    },

    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
      minWidth: 200,
    },
    primaryBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
      fontSize: 16,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    secondaryText: {
      ...typography.bodyStrong,
      color: c.textPrimary,
    },
    linkWrap: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
    },
    link: {
      ...typography.caption,
      color: c.primary,
      fontWeight: '700',
    },

    // Confirm sheet
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    sheetIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: {
      ...typography.h3,
      color: c.textPrimary,
    },
    sheetToken: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    sheetBody: {
      ...typography.body,
      color: c.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
  });