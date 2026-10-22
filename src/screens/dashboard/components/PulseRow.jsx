// src/screens/dashboard/components/PulseRow.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { fmt } from './utils';

function PulseRowBase({ pulse }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!pulse) return null;

  const items = [
    { label: 'Sales', value: fmt(pulse.sales), icon: 'cash-outline' },
    {
      label: 'Transactions',
      value: fmt(pulse.transactions),
      icon: 'receipt-outline',
    },
    {
      label: 'Profit',
      value: pulse.profit != null ? fmt(pulse.profit) : '—',
      icon: 'trending-up-outline',
    },
  ];

  return (
    <View style={styles.wrap}>
      {items.map((m, i) => (
        <View key={m.label} style={[styles.item, i > 0 && styles.divider]}>
          <Ionicons name={m.icon} size={16} color={c.textMuted} />
          <Text style={styles.value} numberOfLines={1}>
            {m.value}
          </Text>
          <Text style={styles.label}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      marginTop: spacing.md,
      paddingVertical: spacing.lg,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
    },
    divider: { borderLeftWidth: 1, borderLeftColor: c.border },
    value: { ...typography.h3, color: c.textPrimary },
    label: { ...typography.caption, color: c.textMuted },
  });

export const PulseRow = memo(PulseRowBase);
export default PulseRow;