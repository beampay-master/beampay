import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../src/constants/colors";
import { Button } from "../src/components/Button";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hasWallet } from "../src/services/walletSecurity";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BeamPayLogo from "../assets/BeamPayLogo.svg";

// Feature pills data
const FEATURES = [
  { icon: "flash" as const, label: "Instant", align: "left" },
  { icon: "lock-closed" as const, label: "Non-Custodial", align: "center" },
  { icon: "qr-code" as const, label: "Tap or Scan", align: "right" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Splash fade out
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Staggered entrance animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const pillsAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const splashTimer = setTimeout(async () => {
      // Check if user already has a wallet → send to login
      // Otherwise show onboarding
      try {
        const walletExists = await hasWallet();
        const token = await AsyncStorage.getItem("auth_token");
        if (walletExists && token) {
          router.replace("/(personal)/home");
          return;
        }
      } catch { /* ignore */ }

      // Fade out splash, then show main onboarding screen
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
        Animated.stagger(100, [
          Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(pillsAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(titleAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(subtitleAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(btnAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();
      });
    }, 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  const toStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  });

  if (showSplash) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <BeamPayLogo width={180} height={86} />
        <Text style={styles.splashText}>BeamPay</Text>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>

        {/* Logo */}
        <Animated.View style={[styles.logoRow, toStyle(logoAnim)]}>
          <BeamPayLogo width={110} height={52} />
        </Animated.View>

        {/* Feature pills — slide in staggered */}
        <Animated.View style={[styles.pillsWrapper, toStyle(pillsAnim)]}>
          {FEATURES.map((f) => (
            <View
              key={f.label}
              style={[
                styles.pill,
                f.align === "center" && styles.pillCenter,
                f.align === "right" && styles.pillRight,
              ]}
            >
              <View style={styles.pillIconWrap}>
                <Ionicons name={f.icon} size={18} color={COLORS.white} />
              </View>
              <Text style={styles.pillText}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Headline */}
        <Animated.View style={[styles.titleContainer, toStyle(titleAnim)]}>
          <Text style={styles.title}>MONEY MOVES</Text>
          <Text style={styles.titleAccent}>AT BEAM SPEED</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={[styles.subtitleWrap, toStyle(subtitleAnim)]}>
          <Text style={styles.subtitle}>
            Send crypto to anyone, anywhere, instantly.{"\n"}No middleman. No delays.
          </Text>
        </Animated.View>

        {/* Trust row */}
        <Animated.View style={[styles.trustRow, toStyle(subtitleAnim)]}>
          {["Stellar Network", "Non-Custodial", "Instant Settlement"].map((t) => (
            <View key={t} style={styles.trustBadge}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.secondary} />
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.footer, toStyle(btnAnim)]}>
          <Button
            title="Get Started"
            onPress={() => router.push("/account-type")}
            variant="primary"
            style={styles.primaryBtn}
            textStyle={styles.primaryBtnText}
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/login")}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>I already have a wallet</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Splash
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  splashText: {
    fontSize: 72,
    fontFamily: "Anton_400Regular",
    color: COLORS.secondary,
    letterSpacing: 3,
  },

  // Main screen
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: "space-between",
  },

  // Logo
  logoRow: {
    alignItems: "flex-start",
    paddingTop: 8,
  },

  // Feature pills
  pillsWrapper: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    paddingVertical: 16,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 14,
    alignSelf: "flex-start",
    minWidth: "55%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pillCenter: {
    alignSelf: "center",
    minWidth: "60%",
  },
  pillRight: {
    alignSelf: "flex-end",
    minWidth: "55%",
  },
  pillIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pillText: {
    color: COLORS.white,
    fontSize: 17,
    fontFamily: "Outfit_500Medium",
  },

  // Headline
  titleContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 44,
    fontFamily: "Anton_400Regular",
    color: COLORS.white,
    lineHeight: 50,
  },
  titleAccent: {
    fontSize: 44,
    fontFamily: "Anton_400Regular",
    color: COLORS.secondary,
    lineHeight: 50,
  },

  // Subtitle
  subtitleWrap: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Outfit_400Regular",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 24,
  },

  // Trust badges
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  trustText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: "rgba(255,255,255,0.75)",
    marginLeft: 4,
  },

  // Footer / CTA
  footer: {
    paddingBottom: 4,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 100,
    height: 60,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Outfit_700Bold",
    color: COLORS.secondary,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    color: COLORS.white,
  },
});
