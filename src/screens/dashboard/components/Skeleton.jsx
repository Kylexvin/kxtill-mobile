// src/screens/dashboard/components/Skeleton.jsx
//
// Shared shimmer primitive. A single Animated.Value drives opacity, so
// every skeleton on screen pulses in sync. Uses useNativeDriver (opacity
// is a native-supported prop).
//
// Deliberately opacity-based, not gradient-translate. The gradient version
// looks nicer but requires LinearGradient per skeleton node, which is
// expensive on low-end Android when a full screen of skeletons is up. If
// you want the gradient look later, swap the animated view for a
// LinearGradient wrapper inside this one file — callers are unaffected.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export function Skeleton({ width, height, radius = 8, style }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** A row of shimmering text lines. */
export function SkeletonLines({ widths = ['70%', '40%'], gap = 6, height = 12 }) {
  return (
    <View style={{ gap }}>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} height={height} radius={6} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#D7DCE3' },
});