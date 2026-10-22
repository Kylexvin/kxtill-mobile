// src/screens/dashboard/components/RecentActivity.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { fmt, relTime } from './utils';

function RecentActivityBase({ currency, items }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!items?.length) return null;

  return (
    <View style={styles.group}>
      {items.map((e, i) => {
        const time = e.time ?? e.createdAt ?? e.at;
        return (
          <View
            key={e.id ?? i}
            style={[styles.row, i > 0 && styles.rowDivider]}
          >
            <View style={styles.tile}>
              <Ionicons
                name="receipt-outline"
                size={19}
                color={c.textSecondary}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {e.sub}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>
                {currency} {fmt(e.amount)}
              </Text>
              <Text style={styles.time}>{relTime(time)}</Text>
            </View>
          </View>
        );
      })}
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
    tile: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0 },
    title: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    sub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    amount: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 14 },
    time: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  });

export const RecentActivity = memo(RecentActivityBase);
export default RecentActivity;