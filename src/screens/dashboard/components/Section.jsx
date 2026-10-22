// src/screens/dashboard/components/Section.jsx
import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';

function SectionBase({ title, badge, action, onAction, children }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {action && onAction ? (
          <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.action}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    section: { marginTop: spacing.xxl },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { ...typography.h2, color: c.textPrimary },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 11,
      backgroundColor: c.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: c.danger, fontSize: 12, fontWeight: '800' },
    action: {
      ...typography.caption,
      color: c.link,
      fontWeight: '700',
      fontSize: 13,
    },
  });

export const Section = memo(SectionBase);
export default Section;