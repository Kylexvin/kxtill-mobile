// src/screens/branches/ReceiptScreen.jsx
//
// Fetches the receipt for one sale, renders it, and shares it as an image
// via the native share sheet. Uses react-native-view-shot to capture the
// receipt and expo-sharing to hand it off.
//
// Requires:
//   npx expo install react-native-view-shot expo-sharing

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import { useOrganizationContext } from '../../context/OrganizationContext';
import { api } from '../../services/api';
import ReceiptTemplate from '../../components/receipts/ReceiptTemplate';

export default function ReceiptScreen({ route, navigation }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeOrganization } = useOrganizationContext();

  const { saleId } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);

  const mountedRef = useRef(true);
  const shotRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!activeOrganization?.id || !saleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get(
        `/api/v1/organizations/${activeOrganization.id}/kxtill/sales/${saleId}/receipt`
      );
      if (mountedRef.current) setData(res);
    } catch (e) {
      if (mountedRef.current) {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            'Could not load receipt'
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [activeOrganization?.id, saleId]);

  useEffect(() => {
    load();
  }, [load]);

  const share = useCallback(async () => {
    if (!shotRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share receipt',
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert(
        'Could not share',
        e?.message || 'Please try again.'
      );
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.iconChip}
          >
            <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
          <View style={styles.iconChip} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={c.danger} />
          <Text style={styles.errorTitle}>Could not load receipt</Text>
          <Text style={styles.errorText}>{error || 'Unknown error'}</Text>
          <Pressable onPress={load} style={styles.retryBtn} hitSlop={8}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.iconChip}
        >
          <Ionicons name="arrow-back" size={20} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Receipt
        </Text>
        <TouchableOpacity
          onPress={share}
          hitSlop={10}
          style={[styles.iconChip, sharing && { opacity: 0.6 }]}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Ionicons name="share-outline" size={20} color={c.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ViewShot
          ref={shotRef}
          options={{ format: 'png', quality: 1, result: 'tmpfile' }}
          style={styles.shotWrap}
        >
          <ReceiptTemplate data={data} />
        </ViewShot>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    iconChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.bodyStrong,
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    shotWrap: {
      backgroundColor: '#FFFFFF',
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    errorTitle: {
      ...typography.h3,
      color: c.textPrimary,
      marginTop: spacing.md,
    },
    errorText: {
      ...typography.body,
      color: c.textMuted,
      marginTop: spacing.sm,
      textAlign: 'center',
      maxWidth: 280,
    },
    retryBtn: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
    },
    retryText: {
      ...typography.bodyStrong,
      color: c.textOnPrimary,
    },
  });