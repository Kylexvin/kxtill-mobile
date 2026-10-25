// src/screens/account/OrgPickerModal.jsx
//
// Bottom-sheet style picker for the current user's organizations.
// Same visual language as the branch scope picker on the dashboard.
// Picking an org calls setActiveOrganization(id) — the app then re-fetches
// branches, permissions, and KxTill settings for the new org automatically.

import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';

export default function OrgPickerModal({
  visible,
  organizations,
  currentOrgId,
  onPick,
  onClose,
}) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Switch business</Text>
          <Text style={styles.subtitle}>
            Choose the business you want to work in.
          </Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {(organizations || []).map((org, index) => {
              const active = org.id === currentOrgId;
              const initial =
                org.name?.trim()?.charAt(0)?.toUpperCase() || '?';
              return (
                <Pressable
                  key={org.id}
                  onPress={() => {
                    onPick(org.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.rowDivider,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {org.logo ? (
                    <Image source={{ uri: org.logo }} style={styles.logo} />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                      <Text style={styles.logoInitial}>{initial}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {org.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[org.country, org.currency].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {active ? (
                    <View style={[styles.check, { backgroundColor: c.primary }]}>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={c.textOnPrimary}
                      />
                    </View>
                  ) : (
                    <View style={styles.placeholderCheck} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h3,
      color: c.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.surfaceElevated,
    },
    logoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoInitial: {
      color: c.textPrimary,
      fontWeight: '800',
      fontSize: 18,
    },
    name: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      fontSize: 16,
    },
    meta: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
    },
    check: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderCheck: {
      width: 28,
      height: 28,
    },
    cancel: {
      marginTop: spacing.lg,
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    cancelText: {
      ...typography.bodyStrong,
      color: c.textSecondary,
    },
  });