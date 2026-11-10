import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { spacing, radius } from '../../styles/spacing';

function Ring({ color, delay = 0 }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.ring,
        {
          borderColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [
            {
              scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }),
            },
          ],
        },
      ]}
    />
  );
}

function Step({ label, state, c }) {
  const pop = useRef(new Animated.Value(state === 'done' ? 1 : 0)).current;

  useEffect(() => {
    if (state === 'done') {
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [state, pop]);

  return (
    <View style={s.stepRow}>
      <View style={s.stepIcon}>
        {state === 'done' ? (
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Ionicons name="checkmark-circle" size={20} color={c.primary} />
          </Animated.View>
        ) : state === 'active' ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <View style={[s.dot, { borderColor: c.border }]} />
        )}
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: state === 'active' ? '800' : '600',
          color: state === 'todo' ? c.textMuted : c.textPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function PosLoader({ steps, logo, c }) {
  const activeIdx = steps.findIndex((st) => !st.done);

  return (
    <View style={s.wrap}>
      <View style={s.logoWrap}>
        <Ring color={c.primary} />
        <Ring color={c.primary} delay={900} />
        <View
          style={[s.logoTile, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          {logo ? <Image source={logo} style={s.logo} resizeMode="contain" /> : null}
        </View>
      </View>

      <Text style={[s.title, { color: c.textPrimary }]}>Preparing till…</Text>

      <View style={s.steps}>
        {steps.map((st, i) => (
          <Step
            key={st.label}
            label={st.label}
            c={c}
            state={st.done ? 'done' : i === activeIdx ? 'active' : 'todo'}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 20 },
  logoWrap: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: radius.lg + 8,
    borderWidth: 2,
  },
  logoTile: {
    width: 84,
    height: 84,
    borderRadius: radius.lg + 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 52, height: 52 },
  title: { fontSize: 18, fontWeight: '800' },
  steps: { gap: 10, alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIcon: { width: 22, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
});