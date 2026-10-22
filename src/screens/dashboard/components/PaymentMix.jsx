// src/screens/dashboard/components/PaymentMix.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { payColor } from './utils';

function PaymentMixBase({ methods }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!methods?.length) return null;

  return (
    <View style={[styles.group, styles.pad]}>
      <View style={styles.bar}>
        {methods.map((p) => (
          <View
            key={p.id}
            style={{
              flex: Math.max(1, Number(p.pct) || 0),
              backgroundColor: payColor(p.id, c),
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {methods.map((p) => (
          <View key={p.id} style={styles.item}>
            <View
              style={[styles.dot, { backgroundColor: payColor(p.id, c) }]}
            />
            <Text style={styles.label}>{p.label}</Text>
            <Text style={styles.value}>{p.pct}%</Text>
          </View>
        ))}
      </View>
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
    pad: { padding: spacing.lg },
    bar: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      gap: 2,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: '600',
    },
    value: {
      ...typography.caption,
      color: c.textPrimary,
      fontWeight: '800',
    },
  });

export const PaymentMix = memo(PaymentMixBase);
export default PaymentMix;