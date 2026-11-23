import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { spacing, radius } from '../../styles/spacing';
import useWriteAccess from '../../hooks/useWriteAccess';

export default function ReadOnlyNotice({ title }) {
  const { theme: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const { message, refresh } = useWriteAccess();
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={44} color={c.textMuted} />
        <Text style={styles.title}>
          {title ? `${title} is read-only` : 'Read-only'}
        </Text>
        <Text style={styles.msg}>{message}</Text>

        <Pressable
          onPress={recheck}
          disabled={checking}
          style={[styles.primary, checking && { opacity: 0.6 }]}
        >
          {checking ? (
            <ActivityIndicator color={c.textOnPrimary} />
          ) : (
            <Text style={styles.primaryText}>I've renewed — check again</Text>
          )}
        </Pressable>

        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.secondary}>
            <Text style={styles.secondaryText}>Go back</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: spacing.xl,
    },
    title: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 8,
    },
    msg: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    primary: {
      marginTop: 14,
      minHeight: 46,
      minWidth: 220,
      paddingHorizontal: 20,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: c.textOnPrimary, fontWeight: '800', fontSize: 14 },
    secondary: { paddingVertical: 10, paddingHorizontal: 16 },
    secondaryText: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
  });