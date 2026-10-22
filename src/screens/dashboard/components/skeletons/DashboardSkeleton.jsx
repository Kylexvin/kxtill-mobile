// src/screens/dashboard/components/skeletons/DashboardSkeleton.jsx
//
// Full-page skeleton shown ONLY on first load (data === null && loading).
// It mirrors the real layout — band, hero, pulse, then a few rows — so
// when content arrives there's zero layout shift.
//
// Every block is inside the same <ScrollView> the real screen uses, so
// pull-to-refresh gestures work even while this is visible.

import { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../styles/ThemeProvider';
import { spacing, radius } from '../../../../styles/spacing';
import { Skeleton, SkeletonLines } from '../Skeleton';

function DashboardSkeletonBase() {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Band */}
        <View style={styles.band}>
          <View style={styles.header}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="40%" height={10} radius={5} />
              <Skeleton width="55%" height={18} radius={6} />
            </View>
            <Skeleton width={44} height={44} radius={22} />
          </View>

          <View style={styles.pillRow}>
            <Skeleton width={180} height={28} radius={14} />
          </View>

          <View style={styles.searchWrap}>
            <Skeleton width="100%" height={50} radius={radius.md} />
          </View>
        </View>

        <View style={styles.body}>
          {/* Hero */}
          <View style={styles.hero}>
            <Skeleton width="35%" height={10} radius={5} />
            <View style={{ marginTop: spacing.lg, gap: 10 }}>
              <Skeleton width="70%" height={40} radius={10} />
              <Skeleton width={100} height={22} radius={11} />
            </View>
          </View>

          {/* Pulse */}
          <View style={styles.pulse}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.pulseItem}>
                <Skeleton width={60} height={18} radius={6} />
                <Skeleton width={50} height={10} radius={5} />
              </View>
            ))}
          </View>

          {/* Two sections of rows */}
          {[0, 1].map((s) => (
            <View key={s} style={styles.section}>
              <View style={styles.sectionHead}>
                <Skeleton width={140} height={18} radius={6} />
                <Skeleton width={60} height={12} radius={6} />
              </View>
              <View style={styles.group}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.row, i > 0 && styles.rowDivider]}
                  >
                    <Skeleton width={40} height={40} radius={radius.md} />
                    <View style={{ flex: 1 }}>
                      <SkeletonLines widths={['70%', '40%']} />
                    </View>
                    <Skeleton width={60} height={14} radius={6} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.hero },
    scrollView: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxxl },
    band: {
      backgroundColor: c.hero,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: 84,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    pillRow: { marginTop: spacing.lg },
    searchWrap: { marginTop: spacing.lg },
    body: { paddingHorizontal: spacing.xl },
    hero: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.xl,
      marginTop: -68,
    },
    pulse: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      marginTop: spacing.md,
      paddingVertical: spacing.lg,
    },
    pulseItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
    },
    section: { marginTop: spacing.xxl },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    group: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
  });

export const DashboardSkeleton = memo(DashboardSkeletonBase);
export default DashboardSkeleton;