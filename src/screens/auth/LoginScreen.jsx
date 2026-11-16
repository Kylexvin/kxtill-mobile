// src/screens/auth/LoginScreen.jsx
//
// v4 — the mascot IS the screen.
//
//   • Hero stage: big mascot (~60% of screen width) standing on the receipt's
//     torn edge, with a soft halo behind it and a speech bubble above it.
//   • Every state is a mood, not a message box:
//       idle      → excited, gentle bob, greeting that reacts to the focused field
//       thinking  → thinking pose, slow tilt, "Checking your details…"
//       sad       → sad pose, shake, error lives in the speech bubble
//       offline   → thinking pose + error bubble (network problems aren't the user's fault)
//       success   → excited pose, pop + big halo burst, button turns green
//   • Keyboard open → mascot shrinks smoothly instead of disappearing,
//     so the feeling stays on screen while the person types.
//
// Same props/hooks/contracts as v3: useAuth(), ROUTES, config, BRAND_ICONS.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
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

import excitedAvatar from '../../../assets/muscot/excited.png';
import sadAvatar from '../../../assets/muscot/sad.png';
import thinkingAvatar from '../../../assets/muscot/thinking.png';

const TOOTH = 16;
const COMPACT_SIZE = 88;

const MOOD_IMAGE = {
  idle: excitedAvatar,
  success: excitedAvatar,
  thinking: thinkingAvatar,
  offline: thinkingAvatar,
  sad: sadAvatar,
};

function classifyError(message) {
  if (!message || typeof message !== 'string') return 'sad';
  const m = message.toLowerCase();
  if (
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('reach') ||
    m.includes('connect') ||
    m.includes('server') ||
    m.includes('offline') ||
    m.includes('unavailable')
  ) {
    return 'offline';
  }
  return 'sad';
}

function bubbleCopy({ mood, focusedField, errorText }) {
  if (mood === 'success') return "You're in. Let's go!";
  if (mood === 'thinking') return 'Checking your details…';
  if (mood === 'sad' || mood === 'offline') return errorText;
  if (focusedField === 'email') return 'Hi! Who is signing in?';
  if (focusedField === 'password') return 'Nearly there.';
  return 'Know what sold today.';
}

/* ───────────────────────── Pieces ───────────────────────── */

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
  invalid,
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
        style={[
          styles.input,
          focused && styles.inputFocused,
          invalid && !focused && styles.inputInvalid,
        ]}
        placeholderTextColor={c.textMuted}
        onFocus={onFocusField}
        onBlur={onBlurField}
        selectionColor={c.primary}
        {...inputProps}
      />
    </View>
  );
}

function SpeechBubble({ text, tone }) {
  const styles = useThemedStyles(makeStyles);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [text, enter]);

  const isError = tone === 'error';
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.bubble,
        isError && styles.bubbleError,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.bubbleText, isError && styles.bubbleTextError]}>
        {text}
      </Text>
      <View style={[styles.bubbleTail, isError && styles.bubbleTailError]} />
    </Animated.View>
  );
}

/**
 * The star of the screen. `size` is an Animated node so the parent can shrink
 * it when the keyboard opens without remounting (keeps the bob / halo going).
 */
function MoodAvatar({ mood, size }) {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  // Idle life: a slow bob + halo breathing. Runs for the whole screen lifetime.
  useEffect(() => {
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bobLoop.start();
    haloLoop.start();
    return () => {
      bobLoop.stop();
      haloLoop.stop();
    };
  }, [bob, halo]);

  // One-shot reaction every time the mood changes.
  useEffect(() => {
    pop.setValue(mood === 'success' ? 0.7 : 0.84);
    Animated.spring(pop, {
      toValue: mood === 'success' ? 1.12 : 1,
      friction: 4,
      tension: 130,
      useNativeDriver: true,
    }).start();

    if (mood === 'sad' || mood === 'offline') {
      shake.setValue(0);
      Animated.sequence(
        [-10, 10, -8, 8, -4, 0].map((toValue) =>
          Animated.timing(shake, {
            toValue,
            duration: 60,
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [mood, pop, shake]);

  const haloColor =
    mood === 'sad'
      ? c.danger
      : mood === 'success'
        ? c.success
        : mood === 'thinking' || mood === 'offline'
          ? c.heroOrbB
          : c.heroOrbA;
  const haloOpacity = mood === 'sad' ? 0.28 : mood === 'success' ? 0.5 : 0.7;
  const tilt = mood === 'thinking' || mood === 'offline' ? 4 : 0;

  const haloSize = Animated.multiply(size, 1.25);
  const shadowWidth = Animated.multiply(size, 0.55);

  // NOTE: size is driven by the JS driver (layout), motion by the native driver.
  // They must live on separate Animated nodes, so every piece is outer (size)
  // + inner (motion).
  return (
    <View style={styles.avatarStage}>
      {/* halo */}
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: haloSize, height: haloSize }]}
      >
        <Animated.View
          style={[
            styles.fillRound,
            {
              backgroundColor: haloColor,
              opacity: haloOpacity,
              transform: [
                {
                  scale: Animated.multiply(
                    pop.interpolate({
                      inputRange: [0, 1, 1.12],
                      outputRange: [0.8, 1, 1.18],
                    }),
                    halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] })
                  ),
                },
              ],
            },
          ]}
        />
      </Animated.View>

      {/* ground shadow — shrinks as the mascot bobs up */}
      <Animated.View
        pointerEvents="none"
        style={[styles.groundShadow, { width: shadowWidth }]}
      >
        <Animated.View
          style={[
            styles.fillRound,
            {
              backgroundColor: '#000',
              opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.12] }),
              transform: [
                { scaleX: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
              ],
            },
          ]}
        />
      </Animated.View>

      {/* mascot */}
      <Animated.View style={{ width: size, height: size }}>
        <Animated.Image
          source={MOOD_IMAGE[mood]}
          resizeMode="contain"
          accessibilityLabel={`KxTill mascot, ${mood}`}
          style={{
            width: '100%',
            height: '100%',
            transform: [
              { translateX: shake },
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: [`${-tilt}deg`, `${tilt}deg`] }) },
              { scale: pop },
            ],
          }}
        />
      </Animated.View>
    </View>
  );
}

/* ───────────────────────── Screen ───────────────────────── */

export default function LoginScreen() {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { signIn, beginOAuth, isSubmitting, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [succeeded, setSucceeded] = useState(false);

  const scrollRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const successTimer = useRef(null);

  const busy = isSubmitting;
  const errorText =
    typeof error === 'string' && error.trim().length > 0 ? error : null;

  // One source of truth for how the mascot feels.
  const mood = succeeded
    ? 'success'
    : busy
      ? 'thinking'
      : errorText
        ? classifyError(errorText)
        : 'idle';

  const bubbleText = bubbleCopy({ mood, focusedField, errorText });
  const bubbleTone = mood === 'sad' || mood === 'offline' ? 'error' : 'info';

  // Mascot size: big by default, compact while the keyboard is up.
  const fullSize = Math.min(width * 0.6, height * 0.3, 250);
  const kb = useRef(new Animated.Value(0)).current;
  const avatarSize = kb.interpolate({
    inputRange: [0, 1],
    outputRange: [fullSize, COMPACT_SIZE],
  });

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const go = (toValue) =>
      Animated.timing(kb, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animating layout size
      }).start();
    const s = Keyboard.addListener(showEvt, () => go(1));
    const h = Keyboard.addListener(hideEvt, () => go(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, [kb]);

  // Receipt slides up once on load.
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

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    []
  );

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 260);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password || busy || succeeded) return;
    if (errorText) clearError?.();
    const session = await signIn(email.trim(), password);
    if (!session) return; // error already set in context
    setSucceeded(true);
    successTimer.current = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: ROUTES.MAIN_TABS }],
      });
    }, 900); // a touch longer than v3 so the celebration actually reads
  };

  const handleForgotPassword = async () => {
    try {
      await WebBrowser.openBrowserAsync(buildForgotPasswordUrl());
    } catch {}
  };

  const handleOAuth = async (provider) => {
    try {
      await beginOAuth(provider);
    } catch {}
  };

  const goPair = () => navigation.navigate(ROUTES.PAIR_DEVICE);

  const invalid = mood === 'sad';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={styles.orbA} />
      <View pointerEvents="none" style={styles.orbB} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Stage: brand row, speech bubble, mascot ───────── */}
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

            <View style={styles.bubbleWrap}>
              <SpeechBubble text={bubbleText} tone={bubbleTone} />
            </View>

            <MoodAvatar mood={mood} size={avatarSize} />
          </View>

          {/* ── Receipt (mascot stands on its torn edge) ───────── */}
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

              <Field
                label="Email"
                inputRef={emailRef}
                focused={focusedField === 'email'}
                invalid={invalid}
                onFocusField={() => {
                  setFocusedField('email');
                  scrollToEndSoon();
                }}
                onBlurField={() => setFocusedField(null)}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                editable={!busy && !succeeded}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              <Field
                label="Password"
                inputRef={passwordRef}
                focused={focusedField === 'password'}
                invalid={invalid}
                onFocusField={() => {
                  setFocusedField('password');
                  scrollToEndSoon();
                }}
                onBlurField={() => setFocusedField(null)}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                placeholder="Your password"
                editable={!busy && !succeeded}
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
                style={[
                  styles.primaryBtn,
                  busy && styles.disabled,
                  succeeded && styles.successBtn,
                ]}
                onPress={handleSubmit}
                disabled={busy || succeeded}
                activeOpacity={0.88}
              >
                {busy ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : succeeded ? (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={c.textOnPrimary}
                    />
                    <Text style={styles.primaryBtnText}>Signed in</Text>
                  </>
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mood === 'sad' || mood === 'offline' ? 'Try again' : 'Sign in'}
                  </Text>
                )}
              </TouchableOpacity>

              {config.oauthEnabled ? (
                <>
                  <View style={styles.orRow}>
                    <DashedRule style={styles.orRule} />
                    <Text style={styles.orText}>or</Text>
                    <DashedRule style={styles.orRule} />
                  </View>

                  <View style={styles.oauthRow}>
                    <TouchableOpacity
                      style={[styles.oauthBtn, busy && styles.disabled]}
                      onPress={() => handleOAuth('oauth')}
                      disabled={busy || succeeded}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={BRAND_ICONS.kxbyte}
                        style={styles.kxbyteLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.oauthText}>KXBYTE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.oauthBtn, busy && styles.disabled]}
                      onPress={() => handleOAuth('google')}
                      disabled={busy || succeeded}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="logo-google"
                        size={18}
                        color={c.textPrimary}
                      />
                      <Text style={styles.oauthText}>Google</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

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
    scroll: { flexGrow: 1, justifyContent: 'flex-start' },
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

    // zIndex lifts the mascot above the receipt so it can overlap the torn edge
    hero: {
      paddingHorizontal: 24,
      paddingTop: 12,
      zIndex: 2,
      marginBottom: -22,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
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

    // Speech bubble
    bubbleWrap: { alignItems: 'center', marginBottom: 14, minHeight: 56 },
    bubble: {
      backgroundColor: c.sheet,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 18,
      maxWidth: '92%',
    },
    bubbleError: { backgroundColor: c.dangerSoft },
    bubbleText: {
      color: c.textPrimary,
      fontSize: 19,
      lineHeight: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    bubbleTextError: { color: c.danger, fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 0 },
    bubbleTail: {
      position: 'absolute',
      bottom: -7,
      alignSelf: 'center',
      width: 16,
      height: 16,
      borderRadius: 3,
      backgroundColor: c.sheet,
      transform: [{ rotate: '45deg' }],
    },
    bubbleTailError: { backgroundColor: c.dangerSoft },

    // Mascot stage
    avatarStage: { alignItems: 'center', justifyContent: 'flex-end' },
    halo: { position: 'absolute', bottom: 0 },
    groundShadow: { position: 'absolute', bottom: -2, height: 14 },
    fillRound: { ...StyleSheet.absoluteFillObject, borderRadius: 9999 },

    receiptWrap: { width: '100%', zIndex: 1 },
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
    inputInvalid: { borderBottomColor: c.danger },

    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
    },
    successBtn: { backgroundColor: c.success },
    primaryBtnText: {
      color: c.textOnPrimary,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.2,
    },

    orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
    orRule: { flex: 1 },
    orText: { color: c.textSecondary, fontSize: 13, marginHorizontal: 12 },

    oauthRow: { flexDirection: 'row', gap: 12 },
    oauthBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.surfaceElevated,
    },
    oauthText: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    kxbyteLogo: { width: 20, height: 20 },

    footer: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    footerLink: { color: c.link, fontWeight: '700' },
  }); 