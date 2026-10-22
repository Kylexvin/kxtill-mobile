// src/screens/common/PlaceholderScreen.jsx
//
// Temporary screen for tabs whose real content belongs to a later phase.
// Visual language matches Select screens: kicker, title, subtitle, one
// icon chip, no fake data.

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';

export default function PlaceholderScreen({
  kicker,
  title,
  description,
  iconName = 'construct-outline',
  phase,
}) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View pointerEvents="none" style={styles.glow} />

      <View style={styles.header}>
        <Text style={styles.brand}>KxTill</Text>
      </View>

      <View style={styles.body}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}

        <View style={styles.iconChip}>
          <Ionicons name={iconName} size={36} color={c.primary} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>

        {phase ? (
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={12} color={c.textMuted} />
            <Text style={styles.badgeText}>{phase}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    glow: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 340,
      height: 340,
      borderRadius: 170,
      backgroundColor: c.primary,
      opacity: 0.08,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    brand: { ...typography.h2, color: c.primary, fontWeight: '800', letterSpacing: -0.3 },
    body: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    kicker: {
      ...typography.label,
      color: c.primary,
      letterSpacing: 1.6,
      marginBottom: spacing.lg,
    },
    iconChip: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.h1,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 340,
      marginBottom: spacing.xl,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    badgeText: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  });