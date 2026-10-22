// src/screens/onboarding/OnboardingScreen.jsx
//
// Three slides, one benefit each:
//   1. Visibility  — see the business at a glance
//   2. Alerts      — know when it matters
//   3. Branches    — every branch, one view
//
// Dark background, KxTill orange accents, restrained motion.
// Horizontal paging via ScrollView + pagingEnabled. No gesture-handler.
// Respects reduce-motion (accessibility setting) by skipping entrance
// animations when enabled.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { useOnboarding } from '../../context/OnboardingContext';

const SLIDES = [
  {
    key: 'overview',
    kicker: 'BUSINESS OVERVIEW',
    title: 'Your business. At a glance.',
    body:
      'See sales, track performance and understand how your branches are doing — all from your phone.',
    icon: 'stats-chart-outline',
  },
  {
    key: 'alerts',
    kicker: 'STAY INFORMED',
    title: 'Know when it matters.',
    body:
      'Get alerts about stock, shifts and important business activity so you can respond wherever you are.',
    icon: 'notifications-outline',
  },
  {
    key: 'branches',
    kicker: 'MULTI-BRANCH',
    title: 'Every branch. One view.',
    body:
      'Monitor stock, compare performance and review operations with access tailored to your role.',
    icon: 'git-branch-outline',
  },
];

// ---------- Mock illustrations ----------

function OverviewMock({ c, styles, animate }) {
  const fade = useFadeIn(animate);
  const sales = useCountUp(48250, animate, 900);
  const txs = useCountUp(126, animate, 700);
  const branches = useCountUp(3, animate, 500);

  return (
    <Animated.View style={[styles.mockCard, fade]}>
      <Text style={[styles.mockKicker, { color: c.textMuted }]}>
        TODAY'S PERFORMANCE
      </Text>
      <Text style={[styles.mockValue, { color: c.textPrimary }]}>
        KES {sales.toLocaleString()}
      </Text>
      <View style={styles.mockRow}>
        <Ionicons name="trending-up" size={16} color={c.success} />
        <Text style={[styles.mockSub, { color: c.success }]}>
          {' '}Sales overview
        </Text>
      </View>

      <View style={styles.mockStatsRow}>
        <View style={styles.mockStat}>
          <Text style={[styles.mockStatLabel, { color: c.textMuted }]}>
            Transactions
          </Text>
          <Text style={[styles.mockStatValue, { color: c.textPrimary }]}>
            {txs}
          </Text>
        </View>
        <View style={styles.mockDivider} />
        <View style={styles.mockStat}>
          <Text style={[styles.mockStatLabel, { color: c.textMuted }]}>
            Branches
          </Text>
          <Text style={[styles.mockStatValue, { color: c.textPrimary }]}>
            {String(branches).padStart(2, '0')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AlertsMock({ c, styles, animate }) {
  const a1 = useFadeIn(animate, 150);
  const a2 = useFadeIn(animate, 350);

  return (
    <View style={styles.mockStack}>
      <Animated.View
        style={[
          styles.alertCard,
          { borderColor: c.border, backgroundColor: c.surfaceElevated },
          a1,
        ]}
      >
        <View style={[styles.alertIconWrap, { backgroundColor: c.dangerSoft }]}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertTitle, { color: c.textPrimary }]}>
            Low stock alert
          </Text>
          <Text style={[styles.alertSub, { color: c.textMuted }]}>
            Cooking Oil · Main Branch
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.alertValue, { color: c.danger }]}>4</Text>
          <Text style={[styles.alertValueLabel, { color: c.textMuted }]}>
            units
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.alertCard,
          { borderColor: c.border, backgroundColor: c.surfaceElevated },
          a2,
        ]}
      >
        <View style={[styles.alertIconWrap, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="time-outline" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertTitle, { color: c.textPrimary }]}>
            Shift closed
          </Text>
          <Text style={[styles.alertSub, { color: c.textMuted }]}>
            CBD Branch · Reconciliation complete
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function BranchesMock({ c, styles, animate }) {
  const a1 = useFadeIn(animate, 150);
  const a2 = useFadeIn(animate, 300);
  const a3 = useFadeIn(animate, 500);
  const v1 = useCountUp(32400, animate, 800);
  const v2 = useCountUp(15850, animate, 800);

  return (
    <View style={styles.mockStack}>
      <Animated.View
        style={[
          styles.branchCard,
          { borderColor: c.border, backgroundColor: c.surfaceElevated },
          a1,
        ]}
      >
        <View>
          <Text style={[styles.branchName, { color: c.textPrimary }]}>
            CBD Branch
          </Text>
          <Text style={[styles.branchLabel, { color: c.textMuted }]}>
            Sales today
          </Text>
        </View>
        <Text style={[styles.branchValue, { color: c.textPrimary }]}>
          KES {v1.toLocaleString()}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.branchCard,
          { borderColor: c.border, backgroundColor: c.surfaceElevated },
          a2,
        ]}
      >
        <View>
          <Text style={[styles.branchName, { color: c.textPrimary }]}>
            Westlands
          </Text>
          <Text style={[styles.branchLabel, { color: c.textMuted }]}>
            Sales today
          </Text>
        </View>
        <Text style={[styles.branchValue, { color: c.textPrimary }]}>
          KES {v2.toLocaleString()}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.permissionRow, a3]}>
        <Ionicons name="shield-checkmark-outline" size={14} color={c.primary} />
        <Text style={[styles.permissionText, { color: c.textMuted }]}>
          {' '}Branch access follows your permissions
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------- Hooks ----------

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduce(!!v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => mounted && setReduce(!!v)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

function useFadeIn(animate, delay = 0, duration = 320) {
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, delay, duration, v]);
  return {
    opacity: v,
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };
}

function useCountUp(target, animate, duration = 800) {
  const [val, setVal] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setVal(target);
      return;
    }
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value }) => {
      setVal(Math.round(value * target));
    });
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [animate, target, duration]);
  return val;
}

// ---------- Screen ----------

export default function OnboardingScreen({ onDone }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { complete } = useOnboarding();
  const reduceMotion = useReduceMotion();

  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);

  const goTo = useCallback(
    (i) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: !reduceMotion });
      setIndex(clamped);
    },
    [width, reduceMotion]
  );

  const finish = useCallback(async () => {
    await complete();
    onDone?.();
  }, [complete, onDone]);

  const onMomentumEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== index) setIndex(i);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Ambient glows */}
      <View pointerEvents="none" style={styles.orbA} />
      <View pointerEvents="none" style={styles.orbB} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerBrand, { color: c.textPrimary }]}>KxTill</Text>
        <Text style={[styles.headerCount, { color: c.textMuted }]}>
          {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.illustrationWrap}>
              {i === 0 && <OverviewMock c={c} styles={styles} animate={!reduceMotion} />}
              {i === 1 && <AlertsMock c={c} styles={styles} animate={!reduceMotion} />}
              {i === 2 && <BranchesMock c={c} styles={styles} animate={!reduceMotion} />}
            </View>

            <View style={styles.copy}>
              <View style={styles.kickerRow}>
                <View style={[styles.kickerDot, { backgroundColor: c.primary }]} />
                <Text style={[styles.kicker, { color: c.primary }]}>
                  {s.kicker}
                </Text>
              </View>
              <Text style={[styles.title, { color: c.textPrimary }]}>
                {s.title}
              </Text>
              <Text style={[styles.body, { color: c.textSecondary }]}>
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? c.primary : c.border,
                  width: i === index ? 22 : 6,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: c.primary }]}
          onPress={() => (isLast ? finish() : goTo(index + 1))}
          activeOpacity={0.88}
        >
          <Text style={[styles.ctaText, { color: c.textOnPrimary }]}>
            {isLast ? 'Get started' : 'Next'}
          </Text>
          <Ionicons
            name={isLast ? 'checkmark' : 'arrow-forward'}
            size={18}
            color={c.textOnPrimary}
          />
        </TouchableOpacity>

        {!isLast ? (
          <TouchableOpacity onPress={finish} hitSlop={10} style={styles.skipWrap}>
            <Text style={[styles.skip, { color: c.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipWrap} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1 },

    orbA: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 340,
      height: 340,
      borderRadius: 170,
      backgroundColor: c.primary,
      opacity: 0.10,
    },
    orbB: {
      position: 'absolute',
      top: 100,
      left: -160,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: c.primary,
      opacity: 0.06,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerBrand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    headerCount: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      fontVariant: ['tabular-nums'],
    },

    slide: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    illustrationWrap: {
      minHeight: 340,
      justifyContent: 'center',
      marginBottom: 24,
    },

    // Shared mock card
    mockCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: 22,
    },
    mockKicker: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    mockValue: {
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.2,
      marginTop: 6,
      marginBottom: 6,
    },
    mockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    mockSub: { fontSize: 13, fontWeight: '600' },
    mockStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 16,
    },
    mockStat: { flex: 1 },
    mockStatLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
    mockStatValue: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 4,
      fontVariant: ['tabular-nums'],
    },
    mockDivider: {
      width: 1,
      height: 32,
      backgroundColor: c.border,
      marginHorizontal: 16,
    },

    // Alerts
    mockStack: { gap: 12 },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    alertIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertTitle: { fontSize: 14, fontWeight: '700' },
    alertSub: { fontSize: 12, marginTop: 2 },
    alertValue: { fontSize: 20, fontWeight: '900' },
    alertValueLabel: { fontSize: 10, fontWeight: '600' },

    // Branches
    branchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    branchName: { fontSize: 15, fontWeight: '700' },
    branchLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    branchValue: {
      fontSize: 16,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    permissionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    permissionText: { fontSize: 12 },

    // Copy
    copy: { paddingHorizontal: 4 },
    kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    kickerDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    title: {
      fontSize: 32,
      lineHeight: 36,
      fontWeight: '900',
      letterSpacing: -1,
      marginBottom: 12,
    },
    body: { fontSize: 16, lineHeight: 24 },

    // Footer
    footer: {
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 20,
    },
    dot: { height: 6, borderRadius: 3 },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 54,
      borderRadius: 14,
    },
    ctaText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    skipWrap: { alignItems: 'center', marginTop: 12, height: 24 },
    skip: { fontSize: 13, fontWeight: '600' },
  });

export { SLIDES };