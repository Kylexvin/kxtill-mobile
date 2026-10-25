// src/screens/auth/SelectOrganizationScreen.jsx
//
// Concept: same till-receipt language as LoginScreen. An accent-coloured hero sits
// above a themed sheet with a torn top edge; the sheet slides up once on load.
// Each business is a line item on the receipt.
//
// v2: skeleton loader replaces the plain spinner. The skeleton mirrors the real
// organization rows (logo → name bar → role pill → chevron), so there's zero
// layout shift when the orgs resolve.

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

function isOwnerOrg(org) {
  return Array.isArray(org?.permissions) && org.permissions.includes('*');
}

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

/** Placeholder line item — mirrors the real organization row footprint. */
function OrgRowSkeleton({ isFirst }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      {!isFirst ? <DashedRule /> : null}
      <View style={styles.row}>
        <Skeleton width={44} height={44} radius={14} />
        <View style={styles.rowBody}>
          <View style={styles.titleRow}>
            <Skeleton width="50%" height={16} radius={6} />
            <Skeleton width={64} height={16} radius={999} />
          </View>
          <Skeleton
            width="70%"
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

/** Whole-receipt placeholder: title bar + dashed rule + N rows + total line. */
function OrgListSkeleton({ rows = 3 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Skeleton width={200} height={22} radius={6} />
      <View style={{ height: 12 }} />
      <DashedRule style={{ marginBottom: 6 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <OrgRowSkeleton key={i} isFirst={i === 0} />
      ))}
      <DashedRule style={{ marginTop: 6, marginBottom: 14 }} />
      <View style={styles.totalRow}>
        <Skeleton width={90} height={12} radius={6} />
        <Skeleton width={20} height={15} radius={6} />
      </View>
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

function Shell({ headline, subhead, onSignOut, children }) {
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

export default function SelectOrganizationScreen() {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user, signOut } = useAuth();
  const { organizations, setActiveOrganization, loadingOrgs, error } =
    useOrganizationContext();

  const handlePick = async (org) => {
    await setActiveOrganization(org);
  };

  const greetingName =
    user?.firstName || user?.name?.split?.(' ')?.[0] || 'there';

  // ── Loading ───────────────────────────────────────────────
  if (loadingOrgs) {
    return (
      <Shell
        headline="Opening your tills."
        subhead="Fetching the businesses linked to your account."
        onSignOut={signOut}
      >
        <OrgListSkeleton rows={3} />
      </Shell>
    );
  }

  // ── No org ────────────────────────────────────────────────
  if (organizations.length === 0) {
    return (
      <Shell
        headline="No KxTill access."
        subhead={`${user?.firstName ? `Hi ${user.firstName}. ` : ''}Your account isn't linked to a business yet.`}
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
          <Ionicons name="shield-outline" size={32} color={c.textMuted} />
        </View>
        <Text style={styles.emptyText}>
          Your account is not linked to any business with KxTill enabled.
          Contact your administrator if this is unexpected.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={signOut}
          activeOpacity={0.88}
        >
          <Text style={styles.primaryBtnText}>Sign out</Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  // ── Pick a business ───────────────────────────────────────
  return (
    <Shell
      headline="Pick a business."
      subhead={`Hi, ${greetingName}. Choose where you're working today.`}
      onSignOut={signOut}
    >
      <Text style={styles.paperTitle}>Choose a business</Text>
      <DashedRule style={{ marginBottom: 6 }} />

      {error ? (
        <View style={[styles.errorBox, { marginTop: 12 }]}>
          <Ionicons name="alert-circle" size={18} color={c.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {organizations.map((item, index) => {
        const owner = isOwnerOrg(item);
        const initial = item.name?.trim()?.charAt(0)?.toUpperCase() || '?';
const meta = [
  item.country,
  item.timezone?.split?.('/')?.[1]?.replaceAll?.('_', ' '),
]
  .filter(Boolean)
  .join(' · ');

        return (
          <View key={item.id}>
            {index > 0 ? <DashedRule /> : null}
            <TouchableOpacity
              style={styles.row}
              onPress={() => handlePick(item)}
              activeOpacity={0.7}
            >
              {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text style={styles.logoInitial}>{initial}</Text>
                </View>
              )}

              <View style={styles.rowBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.orgName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.rolePill,
                      owner ? styles.rolePillOwner : styles.rolePillMember,
                    ]}
                  >
                    <Ionicons
                      name={owner ? 'shield-checkmark' : 'person'}
                      size={10}
                      color={owner ? c.primary : c.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleText,
                        { color: owner ? c.primary : c.textSecondary },
                      ]}
                    >
                      {owner ? 'Owner' : 'Member'}
                    </Text>
                  </View>
                </View>
                {meta ? (
                  <Text style={styles.orgMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                ) : null}
              </View>

              <View style={styles.chevron}>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={c.textOnPrimary}
                />
              </View>
            </TouchableOpacity>
          </View>
        );
      })}

      <DashedRule style={{ marginTop: 6, marginBottom: 14 }} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>BUSINESSES</Text>
        <Text style={styles.totalValue}>{organizations.length}</Text>
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
  rowBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orgName: {
    color: c.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  orgMeta: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.surfaceElevated,
  },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoInitial: { color: c.textPrimary, fontWeight: '800', fontSize: 18 },

  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillOwner: {
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  rolePillMember: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.borderStrong,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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