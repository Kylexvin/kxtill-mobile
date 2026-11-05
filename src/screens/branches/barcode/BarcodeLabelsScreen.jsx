// src/screens/branches/barcode/BarcodeLabelsScreen.jsx
//
// Placeholder. Real implementation in the next pass (needs react-native-svg
// for barcode rendering in the PDF). For now shows what it will do.

import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';

export default function BarcodeLabelsScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.iconChip}
        >
          <Ionicons name="arrow-back" size={18} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Barcode labels</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="print-outline" size={32} color={c.primary} />
        </View>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.sub}>
          Prepare product barcode labels for printing. Select products,
          set quantities, choose a label size, and export as PDF.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: c.textPrimary, fontSize: 16, fontWeight: '800' },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    icon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    heading: {
      ...typography.h2,
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    sub: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 22,
    },
  });