// src/components/MoodMascot.jsx
//
// Shared "feelings" kit used by Login, PairDevice and any future auth screen.
//   <SpeechBubble text tone="info|error" />
//   <MoodAvatar mood size />   mood: idle | thinking | sad | offline | success
//
// To add a new expression later: drop the PNG in assets/muscot and add one
// line to MOOD_IMAGE. Nothing else changes.
//
// `size` can be a number or an Animated node (JS-driven). Size lives on the
// outer view, motion (native driver) on the inner view, so the two drivers
// never share a node.

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme, useThemedStyles } from '../../styles/ThemeProvider';

import excitedAvatar from '../../../assets/muscot/excited.png';
import sadAvatar from '../../../assets/muscot/sad.png';
import thinkingAvatar from '../../../assets/muscot/thinking.png';

export const MOOD_IMAGE = {
  idle: excitedAvatar,
  success: excitedAvatar,
  thinking: thinkingAvatar,
  offline: thinkingAvatar,
  sad: sadAvatar,
};

export function SpeechBubble({ text, tone = 'info' }) {
  const styles = useThemedStyles(makeStyles);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [text, enter]);

  const isError = tone === 'error';
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.bubble,
        isError && styles.bubbleError,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.bubbleText, isError && styles.bubbleTextError]}>
        {text}
      </Text>
      <View style={[styles.bubbleTail, isError && styles.bubbleTailError]} />
    </Animated.View>
  );
}

export function MoodAvatar({ mood, size }) {
  const { theme: c } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopOf = (v, ms, easing) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms, easing, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: ms, easing, useNativeDriver: true }),
        ])
      );
    const a = loopOf(bob, 1500, Easing.inOut(Easing.sin));
    const b = loopOf(halo, 2200, Easing.inOut(Easing.quad));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [bob, halo]);

  useEffect(() => {
    pop.setValue(mood === 'success' ? 0.7 : 0.84);
    Animated.spring(pop, {
      toValue: mood === 'success' ? 1.12 : 1,
      friction: 4,
      tension: 130,
      useNativeDriver: true,
    }).start();

    if (mood === 'sad' || mood === 'offline') {
      shake.setValue(0);
      Animated.sequence(
        [-10, 10, -8, 8, -4, 0].map((toValue) =>
          Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true })
        )
      ).start();
    }
  }, [mood, pop, shake]);

  const haloColor =
    mood === 'sad'
      ? c.danger
      : mood === 'success'
        ? c.success
        : mood === 'thinking' || mood === 'offline'
          ? c.heroOrbB
          : c.heroOrbA;
  const haloOpacity = mood === 'sad' ? 0.28 : mood === 'success' ? 0.5 : 0.7;
  const tilt = mood === 'thinking' || mood === 'offline' ? 4 : 0;

  const scale = (k) =>
    typeof size === 'number' ? size * k : Animated.multiply(size, k);
  const haloSize = scale(1.25);

  return (
    <View style={styles.avatarStage}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: haloSize, height: haloSize }]}
      >
        <Animated.View
          style={[
            styles.fillRound,
            {
              backgroundColor: haloColor,
              opacity: haloOpacity,
              transform: [
                {
                  scale: Animated.multiply(
                    pop.interpolate({
                      inputRange: [0, 1, 1.12],
                      outputRange: [0.8, 1, 1.18],
                    }),
                    halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] })
                  ),
                },
              ],
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.groundShadow, { width: scale(0.55) }]}
      >
        <Animated.View
          style={[
            styles.fillRound,
            {
              backgroundColor: '#000',
              opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.12] }),
              transform: [
                { scaleX: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
              ],
            },
          ]}
        />
      </Animated.View>

      <Animated.View style={{ width: size, height: size }}>
        <Animated.Image
          source={MOOD_IMAGE[mood]}
          resizeMode="contain"
          accessibilityLabel={`KxTill mascot, ${mood}`}
          style={{
            width: '100%',
            height: '100%',
            transform: [
              { translateX: shake },
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: [`${-tilt}deg`, `${tilt}deg`] }) },
              { scale: pop },
            ],
          }}
        />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    bubble: {
      backgroundColor: c.sheet,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 18,
      maxWidth: '92%',
    },
    bubbleError: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft },
    bubbleText: {
      color: c.textPrimary,
      fontSize: 19,
      lineHeight: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    bubbleTextError: { color: c.danger, fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 0 },
    bubbleTail: {
      position: 'absolute',
      bottom: -7,
      alignSelf: 'center',
      width: 14,
      height: 14,
      borderRadius: 3,
      backgroundColor: c.sheet,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      transform: [{ rotate: '45deg' }],
    },
    bubbleTailError: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft },

    avatarStage: { alignItems: 'center', justifyContent: 'flex-end' },
    halo: { position: 'absolute', bottom: 0 },
    groundShadow: { position: 'absolute', bottom: -2, height: 14 },
    fillRound: { ...StyleSheet.absoluteFillObject, borderRadius: 9999 },
  });