// src/screens/dashboard/components/ShiftCard.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { fmt } from './utils';

function formatOpenedAt(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function ShiftCardBase({ currency, shift }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!shift) return null;

  const opened = formatOpenedAt(shift.since);
  const openText = opened ? `Open since ${opened}` : 'Shift open';

  return (
    <View style={styles.group}>
      <View style={styles.top}>
        <View style={styles.live}>
          <View style={[styles.dot, { backgroundColor: c.success }]} />
          <Text style={styles.liveText}>{openText}</Text>
        </View>
        <Text style={styles.sub}>{shift.cashier || 'Staff'}</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.value} numberOfLines={1}>
            {currency} {fmt(shift.sales)}
          </Text>
          <Text style={styles.label}>Shift sales</Text>
        </View>
        <View style={[styles.stat, styles.divider]}>
          <Text style={styles.value}>{shift.tx}</Text>
          <Text style={styles.label}>Transactions</Text>
        </View>
        <View style={[styles.stat, styles.divider]}>
          <Text style={styles.value}>{fmt(shift.float)}</Text>
          <Text style={styles.label}>Opening float</Text>
        </View>
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
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    liveText: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    sub: { ...typography.caption, color: c.textMuted },
    stats: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingVertical: spacing.lg,
    },
    stat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    divider: { borderLeftWidth: 1, borderLeftColor: c.border },
    value: { ...typography.h3, color: c.textPrimary },
    label: { ...typography.caption, color: c.textMuted },
  });

export const ShiftCard = memo(ShiftCardBase);
export default ShiftCard;