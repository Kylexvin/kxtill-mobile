// src/screens/dashboard/components/AttentionList.jsx
import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { safeIcon, severityTone } from './utils';

function AttentionListBase({ items }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!items?.length) return null;

  return (
    <View style={styles.group}>
      {items.map((a, i) => {
        const t = severityTone(a.severity, c);
        return (
          <View
            key={a.id ?? `${a.title}-${i}`}
            style={[styles.row, i > 0 && styles.rowDivider]}
          >
            <View style={[styles.tile, { backgroundColor: t.bg }]}>
              <Ionicons name={safeIcon(a.icon)} size={19} color={t.fg} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {a.body}
              </Text>
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0 },
    title: { ...typography.bodyStrong, color: c.textPrimary, fontSize: 15 },
    sub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
  });

export const AttentionList = memo(AttentionListBase);
export default AttentionList;