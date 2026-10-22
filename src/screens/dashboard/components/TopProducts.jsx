// src/screens/dashboard/components/TopProducts.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { fmt } from './utils';

function TopProductsBase({ currency, products }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!products?.length) return null;

  return (
    <View style={styles.group}>
      {products.map((p, i) => (
        <View
          key={p.id ?? p.name ?? i}
          style={[styles.row, i > 0 && styles.rowDivider]}
        >
          <View style={styles.rank}>
            <Text style={styles.rankText}>{i + 1}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.sub}>{p.units} sold</Text>
          </View>
          <Text style={styles.amount}>
            {currency} {fmt(p.revenue)}
          </Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    rank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { color: c.textSecondary, fontSize: 13, fontWeight: '800' },
    body: { flex: 1, minWidth: 0 },
    title: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    sub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    amount: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 14 },
  });

export const TopProducts = memo(TopProductsBase);
export default TopProducts;