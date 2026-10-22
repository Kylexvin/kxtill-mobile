// src/screens/auth/PairDeviceScreen.jsx
//
// DUMMY screen — Phase 5 will replace this with the real scanner and
// backend redemption. Right now it exists only so the "Scan to connect"
// entry point has somewhere to land and the UI is settled.

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';

export default function PairDeviceScreen() {
  const navigation = useNavigation();
  const { theme: c } = useTheme();
  const styles = makeStyles(c);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan to connect</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Content */}
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="qr-code-outline" size={48} color={c.primary} />
        </View>

        <Text style={styles.title}>Pair your POS</Text>
        <Text style={styles.subtitle}>
          This feature is coming soon. Once enabled, you&apos;ll be able to
          scan a QR code from your POS to connect this device.
        </Text>

        <View style={styles.stepsCard}>
          <Step n="1" text="Open KxTill POS on your computer" color={c} styles={styles} />
          <Step n="2" text="Go to Settings → Mobile app" color={c} styles={styles} />
          <Step n="3" text="Tap 'Show QR code' and scan it here" color={c} styles={styles} />
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.closeBtnText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Step({ n, text, color: c, styles }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
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
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: c.surface,
    },
    headerTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
    },

    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.h1,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    subtitle: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xxl,
      lineHeight: 22,
      maxWidth: 340,
    },

    stepsCard: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: {
      color: c.primary,
      fontWeight: '800',
      fontSize: 13,
    },
    stepText: {
      ...typography.body,
      color: c.textPrimary,
      flex: 1,
    },

    footer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    closeBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    closeBtnText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
      fontSize: 16,
    },
  });