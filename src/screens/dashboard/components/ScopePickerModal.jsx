// src/screens/dashboard/components/ScopePickerModal.jsx
//
// Small centred sheet for choosing All branches vs a specific branch.
// Uses a Pressable overlay for outside-tap dismiss, and a View inside with
// onStartShouldSetResponder so taps on the sheet don't bubble to the
// overlay (cleaner than `onPress={() => {}}`).

import { memo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';

function ScopePickerModalBase({ visible, options, value, onPick, onClose }) {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);

  const handlePick = useCallback(
    (id) => () => onPick(id),
    [onPick]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={styles.card}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>View scope</Text>
          {options.map((o) => {
            const active = (value ?? null) === (o.id ?? null);
            return (
              <TouchableOpacity
                key={o.id ?? 'all'}
                style={[styles.row, active && styles.rowActive]}
                onPress={handlePick(o.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.rowText,
                    active && { color: c.primary, fontWeight: '800' },
                  ]}
                >
                  {o.name}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={18} color={c.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    title: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    rowActive: { backgroundColor: c.primarySoft },
    rowText: { ...typography.bodyStrong, color: c.textPrimary },
  });

export const ScopePickerModal = memo(ScopePickerModalBase);
export default ScopePickerModal;