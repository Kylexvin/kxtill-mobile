// src/screens/auth/LoginScreen.jsx
//
// Password sign-in only. The "Scan to connect" chip at the top of the
// hero is still the primary way in for cashiers on a POS — password is
// the fallback for owners/admins.
//
// v3 — password-only login:
//   - Removed KXBYTE and Google OAuth blocks.
//   - Removed the "or" separator.
//   - Removed beginOAuth usage. WebBrowser is still imported for
//     forgot-password and legal links.
//   - Layout tightens: Sign in → dashed rule → legal footer.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  Pressable,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme, useThemedStyles } from '../../styles/ThemeProvider';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import {
  config,
  buildForgotPasswordUrl,
  BRAND_ICONS,
} from '../../constants/config';

const TOOTH = 16;

/** Row of triangles that gives the paper its torn top edge. */
function TornEdge() {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const count = Math.ceil(width / TOOTH) + 1;
  return (
    <View style={styles.edgeRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.tooth} />
      ))}
    </View>
  );
}

function DashedRule({ style }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.rule, style]} />;
}

function Field({
  label,
  focused,
  right,
  inputRef,
  onFocusField,
  onBlurField,
  ...inputProps
}) {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {right}
      </View>
      <TextInput
        ref={inputRef}
        style={[styles.input, focused && styles.inputFocused]}
        placeholderTextColor={c.textMuted}
        onFocus={onFocusField}
        onBlur={onBlurField}
        selectionColor={c.primary}
        {...inputProps}
      />
    </View>
  );
}

export default function LoginScreen() {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { signIn, isSubmitting, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const passwordRef = useRef(null);
  const busy = isSubmitting;

  // One orchestrated moment: the receipt prints.
  const print = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(print, {
      toValue: 1,
      duration: 650,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [print]);

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    try {
      await signIn(email.trim(), password);
    } catch {
      // error surfaced by auth context
    }
  };

  const handleForgotPassword = async () => {
    try {
      await WebBrowser.openBrowserAsync(buildForgotPasswordUrl());
    } catch {
      // ignore
    }
  };

  const goPair = () => navigation.navigate(ROUTES.PAIR_DEVICE);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={styles.orbA} />
      <View pointerEvents="none" style={styles.orbB} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero ─────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.topRow}>
              <View style={styles.brandRow}>
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
                style={[styles.scanChip, busy && styles.disabled]}
                onPress={goPair}
                disabled={busy}
                activeOpacity={0.8}
                hitSlop={6}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={16}
                  color={c.textOnPrimary}
                />
                <Text style={styles.scanChipText}>Scan to connect</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.headline}>Know what sold today.</Text>
            <Text style={styles.subhead}>
              Sign in to check sales, stock and your team.
            </Text>
          </View>

          {/* ── Receipt ──────────────────────────────── */}
          <Animated.View
            style={[
              styles.receiptWrap,
              {
                opacity: print,
                transform: [
                  {
                    translateY: print.interpolate({
                      inputRange: [0, 1],
                      outputRange: [90, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TornEdge />
            <View
              style={[
                styles.paper,
                { paddingBottom: Math.max(insets.bottom, 16) + 16 },
              ]}
            >
              <Text style={styles.paperTitle}>Sign in</Text>
              <DashedRule style={{ marginBottom: 18 }} />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={c.danger}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Field
                label="Email"
                focused={focusedField === 'email'}
                onFocusField={() => setFocusedField('email')}
                onBlurField={() => setFocusedField(null)}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              <Field
                label="Password"
                inputRef={passwordRef}
                focused={focusedField === 'password'}
                onFocusField={() => setFocusedField('password')}
                onBlurField={() => setFocusedField(null)}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                placeholder="Your password"
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                right={
                  <View style={styles.rightActions}>
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={10}
                    >
                      <Text style={styles.linkText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                    {config.forgotPasswordEnabled ? (
                      <Pressable
                        onPress={handleForgotPassword}
                        disabled={busy}
                        hitSlop={10}
                      >
                        <Text style={styles.linkText}>Forgot password?</Text>
                      </Pressable>
                    ) : null}
                  </View>
                }
              />

              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.disabled]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.88}
              >
                {busy ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign in</Text>
                )}
              </TouchableOpacity>

              <DashedRule style={{ marginTop: 22, marginBottom: 14 }} />
              <Text style={styles.footer}>
                By signing in you agree to KxTill&apos;s{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() =>
                    WebBrowser.openBrowserAsync(
                      'https://kxbyte.co.ke/terms-of-service'
                    )
                  }
                >
                  terms
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() =>
                    WebBrowser.openBrowserAsync(
                      'https://kxbyte.co.ke/privacy-policy'
                    )
                  }
                >
                  privacy policy
                </Text>
                .
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.hero },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'space-between' },
    disabled: { opacity: 0.6 },

    orbA: {
      position: 'absolute',
      top: -140,
      right: -110,
      width: 340,
      height: 340,
      borderRadius: 170,
      backgroundColor: c.heroOrbA,
      opacity: 0.55,
    },
    orbB: {
      position: 'absolute',
      top: 120,
      left: -150,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: c.heroOrbB,
      opacity: 0.6,
    },

    hero: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 44,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    logoChip: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    brandLogo: { width: 28, height: 28 },
    brandName: {
      color: c.textOnPrimary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    brandBy: { color: c.onPrimaryMuted, fontSize: 12, marginTop: 1 },

    scanChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
    },
    scanChipText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '600' },

    headline: {
      color: c.textOnPrimary,
      fontSize: 40,
      lineHeight: 42,
      fontWeight: '900',
      letterSpacing: -1.4,
      maxWidth: 300,
    },
    subhead: {
      color: c.onPrimaryMuted,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 12,
      maxWidth: 300,
    },

    receiptWrap: { width: '100%' },
    edgeRow: {
      flexDirection: 'row',
      height: 10,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    tooth: {
      width: 0,
      height: 0,
      borderLeftWidth: TOOTH / 2,
      borderRightWidth: TOOTH / 2,
      borderBottomWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: c.sheet,
    },
    paper: {
      backgroundColor: c.sheet,
      paddingHorizontal: 24,
      paddingTop: 18,
    },
    paperTitle: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginBottom: 12,
    },
    rule: {
      height: 1,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
      borderRadius: 1,
    },

    fieldWrap: { marginBottom: 18 },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    rightActions: { flexDirection: 'row', gap: 14 },
    linkText: { color: c.link, fontSize: 13, fontWeight: '700' },
    input: {
      color: c.textPrimary,
      fontSize: 17,
      paddingVertical: 12,
      paddingHorizontal: 0,
      borderBottomWidth: 2,
      borderBottomColor: c.borderStrong,
    },
    inputFocused: { borderBottomColor: c.primary },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.dangerSoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 18,
    },
    errorText: { flex: 1, color: c.danger, fontSize: 13, fontWeight: '600' },

    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.2,
    },

    footer: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    footerLink: { color: c.link, fontWeight: '700' },
  });