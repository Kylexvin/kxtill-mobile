// src/screens/splash/SplashScreen.jsx
//
// Branded splash shown while auth + onboarding + org context hydrate.
// Uses the hero color as the canvas so it blends into whichever screen
// follows (login band or dashboard band) — no "grey spinner → colored app"
// transition. A subtle pulsing ring around the logo signals work in progress
// without a system spinner.

import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../../styles/ThemeProvider';
import { BRAND_ICONS } from '../../constants/config';

export default function SplashScreen() {
  const { theme: c } = useTheme();
  const styles = makeStyles(c);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View
            style={[
              styles.ring,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          <View style={styles.mark}>
            <Image
              source={BRAND_ICONS.kxtill}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
        <Text style={styles.brand}>KxTill</Text>
        <Text style={styles.by}>by KXBYTE</Text>
      </View>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.hero,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { alignItems: 'center' },
    markWrap: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: c.textOnPrimary,
    },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: { width: 40, height: 40 },
    brand: {
      color: c.textOnPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.6,
      marginTop: 24,
    },
    by: {
      color: c.onPrimaryMuted,
      fontSize: 13,
      marginTop: 4,
      letterSpacing: 0.5,
    },
  });