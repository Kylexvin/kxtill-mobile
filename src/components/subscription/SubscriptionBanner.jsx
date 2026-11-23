import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../styles/ThemeProvider';
import { useSubscription } from '../../context/SubscriptionContext';

// Same states and colours as the web banner. Renewal happens on the web,
// so there are no buttons, only wording.
const CONFIG = {
  TRIAL: {
    icon: 'information-circle',
    bg: 'rgba(64, 156, 255, 0.12)',
    border: 'rgba(64, 156, 255, 0.35)',
    color: '#409cff',
    label: 'Trial',
    message: (d) =>
      `${d.remainingDays ?? 0} day${d.remainingDays === 1 ? '' : 's'} left in your trial`,
  },
  ACTIVE: {
    icon: 'warning',
    bg: 'rgba(255, 180, 0, 0.12)',
    border: 'rgba(255, 180, 0, 0.40)',
    color: '#d9a300',
    label: 'Renew soon',
    message: (d) =>
      `Ends in ${d.remainingDays ?? 0} day${d.remainingDays === 1 ? '' : 's'}. Renew on the web to avoid interruption`,
  },
  GRACE: {
    icon: 'warning',
    bg: 'rgba(255, 180, 0, 0.14)',
    border: 'rgba(255, 180, 0, 0.45)',
    color: '#d9a300',
    label: 'Read-only',
    message: (d) =>
      `Changes paused. Renew on the web${
        d.phaseEndsAt
          ? ` before ${new Date(d.phaseEndsAt).toLocaleDateString()}`
          : ''
      }`,
  },
  EXPIRED: {
    icon: 'lock-closed',
    bg: 'rgba(239, 83, 80, 0.14)',
    border: 'rgba(239, 83, 80, 0.45)',
    color: '#ef5350',
    label: 'Expired',
    message: () => 'Changes blocked until you renew on the web',
  },
  SUSPENDED: {
    icon: 'ban',
    bg: 'rgba(255, 106, 43, 0.14)',
    border: 'rgba(255, 106, 43, 0.45)',
    color: '#ff6a2b',
    label: 'Suspended',
    message: () => 'Contact KxByte to restore access',
  },
  CANCELLED: {
    icon: 'close-circle',
    bg: 'rgba(140, 140, 140, 0.14)',
    border: 'rgba(140, 140, 140, 0.45)',
    color: '#9a9a9a',
    label: 'Cancelled',
    message: () => 'Reactivate your subscription on the web',
  },
};

export default function SubscriptionBanner() {
  const { theme: c } = useTheme();
  const { status, remainingDays, phaseEndsAt, isOfflineDerived, refresh } =
    useSubscription();

  const cfg = CONFIG[status];
  if (!cfg) return null; // UNKNOWN or anything else: show nothing
  if (status === 'ACTIVE' && (remainingDays === null || remainingDays > 5)) {
    return null;
  }

  const text = `${cfg.message({ remainingDays, phaseEndsAt })}${
    isOfflineDerived ? ' (offline estimate)' : ''
  }`;

  return (
    // Opaque base so the tint never shows what is behind it.
    <View style={{ backgroundColor: c.surface }}>
      <Pressable
        onPress={refresh}
        accessibilityRole="button"
        accessibilityLabel={`${cfg.label}. ${text}. Tap to check again`}
        style={[
          styles.banner,
          { backgroundColor: cfg.bg, borderTopColor: cfg.border },
        ]}
      >
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
        <View style={[styles.chip, { backgroundColor: cfg.border }]}>
          <Text style={[styles.chipText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
        <Text style={[styles.msg, { color: cfg.color }]} numberOfLines={2}>
          {text}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  msg: { flex: 1, fontSize: 12, fontWeight: '700' },
});