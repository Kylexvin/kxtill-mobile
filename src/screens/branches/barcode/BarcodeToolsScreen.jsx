// src/screens/branches/barcode/BarcodeToolsScreen.jsx
//
// Barcode Tools hub. Three tools: Generate, Scan, Labels.
// Reached from the Quick Actions arc. Each tool is a card.

import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../styles/ThemeProvider';
import { spacing, radius } from '../../../styles/spacing';
import { typography } from '../../../styles/typography';
import { ROUTES } from '../../../constants/routes';

const TOOLS = [
  {
    key: 'generate',
    icon: 'barcode-outline',
    title: 'Generate barcode',
    body: 'Generate and assign a barcode to a product.',
    route: ROUTES.BARCODE_GENERATE,
  },
  {
    key: 'scan',
    icon: 'scan-outline',
    title: 'Scan barcode',
    body: 'Scan and identify an existing product.',
    route: ROUTES.BARCODE_SCANNER,
  },
  {
    key: 'labels',
    icon: 'print-outline',
    title: 'Barcode labels',
    body: 'Prepare product barcode labels for printing.',
    route: ROUTES.BARCODE_LABELS,
  },
];

export default function BarcodeToolsScreen({ navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Floating header */}
        <View style={[styles.headerCard, { marginTop: insets.top + 8 }]}>
          <View pointerEvents="none" style={styles.headerGlow} />

          <View style={styles.headerTop}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={10}
                style={styles.headerIcon}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color={c.textPrimary}
                />
              </Pressable>
              <View style={styles.monogramSmall}>
                <Ionicons
                  name="barcode-outline"
                  size={16}
                  color={c.textOnPrimary}
                />
              </View>
            </View>

            <View
              style={[
                styles.statusChip,
                { backgroundColor: c.primarySoft },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: c.success }]}
              />
              <Text style={[styles.statusText, { color: c.primary }]}>
                Ready
              </Text>
            </View>
          </View>

          <Text style={styles.headerName} numberOfLines={1}>
            Barcode tools
          </Text>
          <Text style={styles.headerSub} numberOfLines={2}>
            Create, scan and manage product barcodes.
          </Text>

          <View style={styles.headerRule} />

          <View style={styles.infoStrip}>
            <Ionicons
              name="barcode-outline"
              size={14}
              color={c.link}
            />
            <Text style={styles.infoStripText} numberOfLines={2}>
              Everything you need to identify your inventory.
            </Text>
          </View>
        </View>

        {/* Tools */}
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>AVAILABLE TOOLS</Text>

          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              onPress={() => navigation.navigate(tool.route)}
              style={({ pressed }) => [
                styles.toolCard,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tool.title}
            >
              <View style={styles.toolIcon}>
                <Ionicons
                  name={tool.icon}
                  size={22}
                  color={c.primary}
                />
              </View>
              <View style={styles.toolBody}>
                <Text style={styles.toolTitle}>{tool.title}</Text>
                <Text style={styles.toolDesc} numberOfLines={2}>
                  {tool.body}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={c.textMuted}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: spacing.xxl },
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

    headerCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    headerGlow: {
      position: 'absolute',
      top: -100,
      right: -80,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: c.primary,
      opacity: 0.08,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramSmall: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

    headerName: {
      color: c.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.6,
    },
    headerSub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
      lineHeight: 18,
    },

    headerRule: {
      height: 1,
      backgroundColor: c.border,
      marginTop: 16,
      marginBottom: 14,
    },

    infoStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
    },
    infoStripText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },

    sectionLabel: {
      ...typography.label,
      color: c.textMuted,
      letterSpacing: 1.4,
      marginBottom: spacing.sm,
    },

    toolCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    toolIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolBody: { flex: 1, minWidth: 0 },
    toolTitle: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    toolDesc: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
      lineHeight: 16,
    },
  });