// src/screens/dashboard/components/QuickActions.jsx
import { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { safeIcon } from './utils';

function QuickActionsBase({ items, onPress }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  if (!items?.length) return null;

  const handle = useCallback(
    (item) => () => onPress?.(item),
    [onPress]
  );

  return (
    <View style={styles.row}>
      {items.map((a) => (
        <TouchableOpacity
          key={a.id ?? a.label}
          style={styles.item}
          activeOpacity={0.8}
          onPress={handle(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
        >
          <View style={styles.icon}>
            <Ionicons name={safeIcon(a.icon)} size={22} color={c.primary} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {a.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.md },
    item: { flex: 1, alignItems: 'center', gap: spacing.sm },
    icon: {
      width: 60,
      height: 60,
      borderRadius: radius.lg,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.caption,
      color: c.textPrimary,
      fontWeight: '700',
    },
  });

export const QuickActions = memo(QuickActionsBase);
export default QuickActions;