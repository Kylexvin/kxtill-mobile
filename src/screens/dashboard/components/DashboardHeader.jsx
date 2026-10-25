// src/screens/dashboard/components/DashboardHeader.jsx
//
// Hero band. The KxTill logo is the main mark; the signed-in user's avatar
// sits on its top-right corner as a small cut-out badge.
//
//   ┌────┐ ◖K◗   ☀ Good morning              [bell•]
//   │logo│       Kylex
//   └────┘
//   [ All branches ] [ Nairobi CBD ] [ Nakuru ] …   ← scope rail
//   [ 🔍  Search products, branches, activity   ✕ ]
//
// Props are primitives + stable callbacks so React.memo stays effective.
// Optional props: scopes [{id,label}], activeScopeId, onSelectScope,
// unreadCount, onPressAvatar (e.g. go to the Account tab).
// Without `scopes`, canSeeOrgWide users get a single "Switch" bar that calls
// onOpenScope. Members who can't pick org-wide see a quiet label.

import { memo, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { BRAND_ICONS } from '../../../constants/config';
import { timeGreeting } from './utils';

const dayIcon = () => {
  const h = new Date().getHours();
  if (h < 5 || h >= 19) return 'moon';
  if (h < 12) return 'sunny';
  return 'partly-sunny';
};

function DashboardHeaderBase({
  firstName,
  initial,
  orgName,
  scopeLabel,
  canSeeOrgWide,
  onOpenScope,
  scopes,
  activeScopeId,
  onSelectScope,
  query,
  onQueryChange,
  onClearQuery,
  onPressBell,
  onPressAvatar,
  unreadCount = 0,
}) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const searching = query.length > 0;
  const hasRail = canSeeOrgWide && Array.isArray(scopes) && scopes.length > 0;

  return (
    <View style={[styles.band, { paddingBottom: searching ? spacing.xl : 84 }]}>
      {/* decoration: concentric rings + one soft disc */}
      <View pointerEvents="none" style={styles.ringOuter} />
      <View pointerEvents="none" style={styles.ringInner} />
      <View pointerEvents="none" style={styles.disc} />

      {/* ── Identity row ───────────────────────────── */}
      <View style={styles.header}>
        {/* Logo is the mark; the user's avatar badges its top-right corner */}
        <View style={styles.markWrap}>
          <View style={styles.logoTile}>
            <Image
              source={BRAND_ICONS.kxtill}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Pressable
            style={styles.avatarBadge}
            onPress={onPressAvatar}
            disabled={!onPressAvatar}
            hitSlop={6}
            accessibilityRole={onPressAvatar ? 'button' : undefined}
            accessibilityLabel={`Account: ${firstName || 'You'}`}
          >
            <Text style={styles.avatarBadgeText}>{initial}</Text>
          </Pressable>
        </View>

        <View style={styles.headerText}>
          <View style={styles.greetRow}>
            <Ionicons name={dayIcon()} size={13} color={c.onPrimaryMuted} />
            <Text style={styles.greeting}>{timeGreeting()}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {firstName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.bell}
          activeOpacity={0.8}
          hitSlop={8}
          onPress={onPressBell}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Ionicons
            name="notifications-outline"
            size={21}
            color={c.textOnPrimary}
          />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* ── Scope ──────────────────────────────────── */}
      {hasRail ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.rail}
          contentContainerStyle={styles.railContent}
        >
          {scopes.map((s) => {
            const active = s.id === activeScopeId;
            return (
              <Pressable
                key={s.id}
                onPress={() => onSelectScope?.(s.id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`View ${s.label}`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : canSeeOrgWide ? (
        <Pressable
          style={({ pressed }) => [styles.switchBar, pressed && styles.pressed]}
          onPress={onOpenScope}
          accessibilityRole="button"
          accessibilityLabel={`Viewing ${scopeLabel}. Switch scope`}
        >
          <View style={styles.flex}>
            <Text style={styles.switchKicker}>VIEWING</Text>
            <Text style={styles.switchValue} numberOfLines={1}>
              {orgName || 'Business'} · {scopeLabel}
            </Text>
          </View>
          <View style={styles.switchAction}>
            <Ionicons
              name="swap-horizontal"
              size={15}
              color={c.textOnPrimary}
            />
            <Text style={styles.switchActionText}>Switch</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.staticScope}>
          <Ionicons
            name="storefront-outline"
            size={14}
            color={c.onPrimaryMuted}
          />
          <Text style={styles.staticScopeText} numberOfLines={1}>
            {orgName || 'Business'} · {scopeLabel}
          </Text>
        </View>
      )}

      {/* ── Search ─────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search products, branches, activity"
          placeholderTextColor={c.textMuted}
          selectionColor={c.primary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search dashboard"
        />
        {searching ? (
          <TouchableOpacity onPress={onClearQuery} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const LOGO_TILE = 56;
const BADGE = 26;

const makeStyles = (c) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.8 },

    band: {
      backgroundColor: c.hero,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },

    // Decoration
    ringOuter: {
      position: 'absolute',
      top: -150,
      right: -150,
      width: 380,
      height: 380,
      borderRadius: 190,
      borderWidth: 1.5,
      borderColor: c.onPrimaryBorder,
      opacity: 0.35,
    },
    ringInner: {
      position: 'absolute',
      top: -100,
      right: -100,
      width: 280,
      height: 280,
      borderRadius: 140,
      borderWidth: 1.5,
      borderColor: c.onPrimaryBorder,
      opacity: 0.5,
    },
    disc: {
      position: 'absolute',
      bottom: -120,
      left: -90,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: c.heroOrbB,
      opacity: 0.55,
    },

    // Identity
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    // wrapper is a bit larger than the tile so the badge isn't clipped
    markWrap: {
      width: LOGO_TILE + BADGE / 2,
      height: LOGO_TILE + BADGE / 2,
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    },
    logoTile: {
      width: LOGO_TILE,
      height: LOGO_TILE,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: { width: 34, height: 34 },
    avatarBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: BADGE + 5,
      height: BADGE + 5,
      borderRadius: (BADGE + 5) / 2,
      backgroundColor: c.textOnPrimary,
      // ring in the hero colour gives the "cut-out" edge against the tile
      borderWidth: 2.5,
      borderColor: c.hero,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarBadgeText: {
      color: c.hero,
      fontSize: 12,
      fontWeight: '900',
    },
    headerText: { flex: 1, minWidth: 0 },
    greetRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    greeting: { ...typography.caption, color: c.onPrimaryMuted },
    name: {
      ...typography.h2,
      color: c.textOnPrimary,
      marginTop: 1,
      letterSpacing: -0.5,
    },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: c.textOnPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: { color: c.hero, fontSize: 10, fontWeight: '900' },

    // Scope rail
    rail: { marginHorizontal: -spacing.xl, marginTop: spacing.lg },
    railContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
    },
    chipActive: {
      backgroundColor: c.textOnPrimary,
      borderColor: c.textOnPrimary,
    },
    chipText: {
      ...typography.caption,
      color: c.textOnPrimary,
      fontWeight: '700',
    },
    chipTextActive: { color: c.hero },

    // Fallback: single switch bar
    switchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
      padding: 10,
      paddingLeft: 14,
      paddingRight: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.onPrimaryBorder,
    },
    switchKicker: {
      color: c.onPrimaryMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    switchValue: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
      marginTop: 1,
    },
    switchAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    switchActionText: {
      ...typography.caption,
      color: c.textOnPrimary,
      fontWeight: '700',
    },

    // Members: quiet label
    staticScope: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.lg,
    },
    staticScopeText: {
      ...typography.caption,
      color: c.onPrimaryMuted,
      fontWeight: '600',
      flexShrink: 1,
    },

    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: 18,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
      marginTop: spacing.lg,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: c.textPrimary,
      paddingVertical: spacing.sm,
    },
  });

export const DashboardHeader = memo(DashboardHeaderBase);
export default DashboardHeader;