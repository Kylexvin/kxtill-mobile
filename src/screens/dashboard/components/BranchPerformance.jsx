// src/screens/dashboard/components/BranchPerformance.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { fmt } from './utils';

function BranchPerformanceBase({ currency, branches }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!branches?.length) return null;

  const top = Math.max(...branches.map((b) => Number(b.sales || 0)), 1);

  return (
    <View style={styles.group}>
      {branches.map((b, i) => (
        <View
          key={b.id ?? b.name ?? i}
          style={[styles.row, i > 0 && styles.rowDivider]}
        >
          <View style={styles.top}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{i + 1}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {b.name}
            </Text>
            <Text style={styles.amount}>
              {currency} {fmt(b.sales)}
            </Text>
          </View>
          <View style={styles.bottom}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.round(
                      (Number(b.sales || 0) / top) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.trend}>
  {b.transactions} {b.transactions === 1 ? 'sale' : 'sales'}
</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    group: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    row: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingLeft: 32 + spacing.md,
    },
    rank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { color: c.textSecondary, fontSize: 13, fontWeight: '800' },
    name: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 15,
      flex: 1,
      minWidth: 0,
    },
    amount: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 14,
    },
    track: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceElevated,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },
    trend: {
      fontSize: 12,
      fontWeight: '800',
      minWidth: 40,
      textAlign: 'right',
      color: c.textMuted,
    },
  });

export const BranchPerformance = memo(BranchPerformanceBase);
export default BranchPerformance;