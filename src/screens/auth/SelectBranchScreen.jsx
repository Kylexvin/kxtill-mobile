// src/screens/auth/SelectBranchScreen.jsx
//
// Concept: same till-receipt language as LoginScreen / SelectOrganizationScreen.
// Accent hero above a themed sheet with a torn top edge that slides up once on load.
// Each branch is a line item on the receipt.
//
// v2: skeleton loader replaces the plain spinner. The skeleton mirrors the
// branch rows (paperTitle bar → dashed rule → three placeholder rows), so
// there is no layout shift when data arrives.

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme, useThemedStyles } from '../../styles/ThemeProvider';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { BRAND_ICONS } from '../../constants/config';

const TOOTH = 16;

/* ── Skeleton primitives ─────────────────────────────────────────── */

/** Single shimmering block. Opacity-only animation; cheap on all devices. */
function Skeleton({ width, height, radius = 8, style }) {
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
        { width, height, borderRadius: radius },
        style,
      ]}
    />
  );
}

/** Placeholder line item — mirrors the real branch row footprint. */
function BranchRowSkeleton({ isFirst }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      {!isFirst ? <DashedRule /> : null}
      <View style={styles.row}>
        <Skeleton width={44} height={44} radius={14} />
        <View style={styles.rowBody}>
          <Skeleton width="65%" height={16} radius={6} />
          <Skeleton
            width="85%"
            height={12}
            radius={6}
            style={{ marginTop: 8 }}
          />
        </View>
        <Skeleton width={32} height={32} radius={16} />
      </View>
    </View>
  );
}

/** Whole-receipt placeholder: title bar + dashed rule + three rows. */
function BranchListSkeleton({ rows = 3 }) {
  return (
    <>
      <Skeleton width={180} height={22} radius={6} />
      <View style={{ height: 12 }} />
      <DashedRule style={{ marginBottom: 6 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <BranchRowSkeleton key={i} isFirst={i === 0} />
      ))}
    </>
  );
}

/* ── Decorative pieces ──────────────────────────────────────────── */

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

/* ── Shell ──────────────────────────────────────────────────────── */

function Shell({ headline, subhead, onBack, onSignOut, children }) {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={styles.orbA} />
      <View pointerEvents="none" style={styles.orbB} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ─────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <View style={styles.brandRow}>
              {onBack ? (
                <TouchableOpacity
                  style={styles.backChip}
                  onPress={onBack}
                  activeOpacity={0.8}
                  hitSlop={8}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={c.textOnPrimary}
                  />
                </TouchableOpacity>
              ) : null}
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
              style={styles.scanChip}
              onPress={onSignOut}
              activeOpacity={0.8}
              hitSlop={6}
            >
              <Ionicons
                name="log-out-outline"
                size={16}
                color={c.textOnPrimary}
              />
              <Text style={styles.scanChipText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subhead}>{subhead}</Text>
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
            {children}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Screen ─────────────────────────────────────────────────────── */

export default function SelectBranchScreen() {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signOut } = useAuth();
  const {
    organizations,
    activeOrganization,
    setActiveOrganization,
    branches,
    setActiveBranch,
    loadingBranches,
    error,
  } = useOrganizationContext();

  const canGoBack = (organizations?.length || 0) > 1;

  const handlePick = async (branch) => {
    if (branch.isActive === false) return;
    await setActiveBranch(branch);
  };

  const handleBack = async () => {
    if (!canGoBack) return;
    await setActiveOrganization(null);
  };

  const orgName = activeOrganization?.name || 'Business';

  // ── Loading ───────────────────────────────────────────────
  // Same Shell, but the paper shows a skeleton that mirrors the real rows.
  if (loadingBranches) {
    return (
      <Shell
        headline="Finding your branches."
        subhead={`Fetching branches for ${orgName}.`}
        onBack={canGoBack ? handleBack : null}
        onSignOut={signOut}
      >
        <BranchListSkeleton rows={3} />
      </Shell>
    );
  }

  const activeCount = branches.filter((b) => b.isActive !== false).length;

  // ── Empty ─────────────────────────────────────────────────
  if (branches.length === 0) {
    return (
      <Shell
        headline="No branches."
        subhead={`You're not assigned to a branch in ${orgName}.`}
        onBack={canGoBack ? handleBack : null}
        onSignOut={signOut}
      >
        <Text style={styles.paperTitle}>Nothing to show</Text>
        <DashedRule style={{ marginBottom: 18 }} />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={c.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.emptyIcon}>
          <Ionicons name="storefront-outline" size={32} color={c.textMuted} />
        </View>
        <Text style={styles.emptyText}>
          You are not assigned to any branch in {orgName}. Ask the owner to add
          you, then sign in again.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={canGoBack ? handleBack : signOut}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>
            {canGoBack ? 'Choose another business' : 'Sign out'}
          </Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  // ── Pick a branch ─────────────────────────────────────────
  return (
    <Shell
      headline="Which branch?"
      subhead={
        activeCount === 1
          ? `One active branch in ${orgName}.`
          : `${activeCount} active branches in ${orgName}.`
      }
      onBack={canGoBack ? handleBack : null}
      onSignOut={signOut}
    >
      <Text style={styles.paperTitle}>Choose a branch</Text>
      <DashedRule style={{ marginBottom: 6 }} />

      {error ? (
        <View style={[styles.errorBox, { marginTop: 12 }]}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {branches.map((item, index) => {
        const inactive = item.isActive === false;
        const meta = [item.address, item.phone].filter(Boolean).join(' · ');

        return (
          <View key={item.id}>
            {index > 0 ? <DashedRule /> : null}
            <TouchableOpacity
              style={[styles.row, inactive && styles.rowDisabled]}
              onPress={() => handlePick(item)}
              disabled={inactive}
              activeOpacity={0.7}
            >
              <View style={styles.branchIcon}>
                <Ionicons
                  name="location-outline"
                  size={22}
                  color={inactive ? c.textMuted : c.primary}
                />
              </View>

              <View style={styles.rowBody}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.branchName,
                      inactive && { color: c.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.isDefault ? (
                    <View style={styles.badgeDefault}>
                      <Ionicons name="star" size={10} color={c.primary} />
                      <Text style={styles.badgeDefaultText}>Default</Text>
                    </View>
                  ) : null}
                  {inactive ? (
                    <View style={styles.badgeInactive}>
                      <Text style={styles.badgeInactiveText}>Inactive</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.branchMeta} numberOfLines={2}>
                  {meta || 'No address on file'}
                </Text>
              </View>

              {!inactive ? (
                <View style={styles.chevron}>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={c.textOnPrimary}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        );
      })}

      <DashedRule style={{ marginTop: 6, marginBottom: 14 }} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>ACTIVE BRANCHES</Text>
        <Text style={styles.totalValue}>{activeCount}</Text>
      </View>
    </Shell>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.hero },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },

  // Background discs
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

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 44,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.onPrimaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
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

  // Receipt
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

  // Line items
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  rowDisabled: { opacity: 0.55 },
  rowBody: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  branchIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: {
    color: c.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  branchMeta: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  badgeDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  badgeDefaultText: {
    color: c.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeInactive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceElevated,
  },
  badgeInactiveText: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Total line
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  totalValue: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },

  // Loading / empty
  loadingBox: { paddingVertical: 24, alignItems: 'center' },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },

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
  },
  primaryBtnText: {
    color: c.textOnPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});