// src/screens/dashboard/components/EmptyState.jsx
//
// One component for every "nothing to show here" state:
//   - searching → "no matches for X"
//   - error     → "couldn't load" + retry
//   - offline   → "you're offline" (when staleError is set but we have data,
//                 the screen renders a small inline chip instead, not this)
//
// Memo-friendly: all props are primitives / stable callbacks.

import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';

function EmptyStateBase({
  icon = 'search-outline',
  title,
  body,
  actionLabel,
  onAction,
}) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={c.textMuted} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    title: { ...typography.h3, color: c.textPrimary, textAlign: 'center' },
    body: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 300,
    },
    action: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: c.primarySoft,
    },
    actionText: { color: c.primary, fontWeight: '800', fontSize: 14 },
  });

export const EmptyState = memo(EmptyStateBase);
export default EmptyState;