// src/screens/auth/SelectOrganizationScreen.jsx
//
// v4 — the mascot is on this screen too (same kit as LoginScreen).
//   Hero stage: brand row, speech bubble, mascot standing on the receipt's
//   torn edge. The state of the screen IS the mascot's mood:
//
//     loading          → thinking  "Opening your tills…"
//     hard failure     → sad/offline, error text in the bubble, Retry below
//     empty            → sad, info bubble
//     list             → excited, greets by name
//     picking a biz    → success pop "Let's go!"
//
//   - loadingOrgs && no orgs          → skeleton
//   - !loadingOrgs && error && !orgs  → full offline/error state with Retry
//   - !loadingOrgs && error && orgs   → inline stale banner, list still usable
//   - !loadingOrgs && !error && !orgs → genuine "no businesses" state
//   - !loadingOrgs && orgs            → list
//
// Uses OrganizationContext.refresh(). Local `retrying` gives button feedback.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
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
import { MoodAvatar, SpeechBubble } from '../../components/kexie/MoodMascot';

const TOOTH = 16;

function isOwnerOrg(org) {
  return Array.isArray(org?.permissions) && org.permissions.includes('*');
}

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

/* ── Skeleton primitives ─────────────────────────────────────────── */

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

function Shell({ mood, bubbleText, bubbleTone = 'info', onSignOut, children }) {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Slightly smaller than Login's hero mascot — the list needs the room.
  const avatarSize = Math.min(width * 0.42, height * 0.2, 170);

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

          <View style={styles.bubbleWrap}>
            <SpeechBubble text={bubbleText} tone={bubbleTone} />
          </View>

          <MoodAvatar mood={mood} size={avatarSize} />
        </View>

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
  const {
    organizations,
    setActiveOrganization,
    loadingOrgs,
    refresh,
    error,
  } = useOrganizationContext();

  const [retrying, setRetrying] = useState(false);
  const [picking, setPicking] = useState(false);

  const handlePick = async (org) => {
    if (picking) return;
    setPicking(true);
    try {
      await setActiveOrganization(org);
    } finally {
      setPicking(false);
    }
  };

  const handleRetry = async () => {
    if (retrying) return;
    if (typeof refresh !== 'function') return; // defensive — never crash
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const greetingName =
    user?.firstName || user?.name?.split?.(' ')?.[0] || 'there';

  const hasOrgs = Array.isArray(organizations) && organizations.length > 0;
  const errorText =
    typeof error === 'string' && error.trim().length > 0 ? error : null;

  // ── Loading (first load only) ─────────────────────────────
  if (loadingOrgs && !hasOrgs) {
    return (
      <Shell
        mood="thinking"
        bubbleText="Opening your tills…"
        onSignOut={signOut}
      >
        <OrgListSkeleton rows={3} />
      </Shell>
    );
  }

  // ── Hard failure, no data ─────────────────────────────────
  if (!loadingOrgs && !hasOrgs && errorText) {
    const mood = classifyError(errorText);
    return (
      <Shell
        mood={mood}
        bubbleText={errorText}
        bubbleTone="error"
        onSignOut={signOut}
      >
        <Text style={styles.paperTitle}>Businesses unavailable</Text>
        <DashedRule style={{ marginBottom: 14 }} />
        <Text style={styles.stateNote}>
          {mood === 'offline'
            ? "We can't reach KxTill. Check your connection and try again."
            : 'We hit a snag loading your businesses.'}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, retrying && styles.disabled]}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.88}
        >
          {retrying ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color={c.textOnPrimary} />
              <Text style={styles.primaryBtnText}>Try again</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={signOut}
          activeOpacity={0.88}
        >
          <Text style={styles.secondaryBtnText}>Sign out</Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  // ── Genuine empty ─────────────────────────────────────────
  if (!loadingOrgs && !hasOrgs && !errorText) {
    return (
      <Shell
        mood="sad"
        bubbleText={`${user?.firstName ? `Hi ${user.firstName}. ` : ''}No business is linked to your account yet.`}
        bubbleTone="info"
        onSignOut={signOut}
      >
        <Text style={styles.paperTitle}>Nothing to show</Text>
        <DashedRule style={{ marginBottom: 14 }} />
        <Text style={styles.stateNote}>
          Your account is not linked to any business with KxTill enabled.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, retrying && styles.disabled]}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.88}
        >
          {retrying ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color={c.textOnPrimary} />
              <Text style={styles.primaryBtnText}>Refresh</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={signOut}
          activeOpacity={0.88}
        >
          <Text style={styles.secondaryBtnText}>Sign out</Text>
        </TouchableOpacity>
      </Shell>
    );
  }

  // ── List (with stale banner when applicable) ──────────────
  return (
    <Shell
      mood={picking ? 'success' : 'idle'}
      bubbleText={
        picking
          ? "Let's go!"
          : `Hi, ${greetingName}! Where are you working today?`
      }
      onSignOut={signOut}
    >
      <Text style={styles.paperTitle}>Choose a business</Text>
      <DashedRule style={{ marginBottom: 6 }} />

      {errorText ? (
        <View style={styles.staleBanner}>
          <Ionicons
            name="cloud-offline-outline"
            size={16}
            color={c.textSecondary}
          />
          <Text style={styles.staleText} numberOfLines={2}>
            Showing saved businesses · {errorText}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            disabled={retrying}
            hitSlop={8}
            accessibilityLabel="Retry loading businesses"
          >
            {retrying ? (
              <ActivityIndicator size="small" color={c.link} />
            ) : (
              <Ionicons name="refresh" size={16} color={c.link} />
            )}
          </TouchableOpacity>
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
              disabled={picking}
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

  // zIndex lifts the mascot above the receipt so it overlaps the torn edge
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

  bubbleWrap: { alignItems: 'center', marginBottom: 14, minHeight: 56 },

  receiptWrap: { width: '100%', zIndex: 1, flexGrow: 1 },
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
    flexGrow: 1,
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

  stateNote: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  staleText: {
    flex: 1,
    color: c.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

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
  primaryBtnText: {
    color: c.textOnPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  secondaryBtn: {
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceElevated,
  },
  secondaryBtnText: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});