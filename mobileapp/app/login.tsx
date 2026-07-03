/**
 * Login Screen — Stellar wallet auth via challenge/signature.
 * New users → create wallet flow
 * Returning users → sign challenge with stored keypair → JWT → home
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { COLORS } from "../src/constants/colors";
import { Button } from "../src/components/Button";
import { Ionicons } from "@expo/vector-icons";
import { retrieveKeypair, hasWallet } from "../src/services/walletSecurity";
import BeamPayLogo from "../assets/BeamPayLogo.svg";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      // 1. Get challenge from backend
      const challengeRes = await fetch(`${API_BASE}/api/auth/challenge`);
      if (!challengeRes.ok) throw new Error("Failed to get challenge");
      const { challenge } = await challengeRes.json();

      // 2. Sign challenge with stored keypair
      const keypair = await retrieveKeypair(0);
      if (!keypair) throw new Error("No wallet found");

      const msgBytes = Buffer.from(challenge, "utf8");
      const signature = keypair.sign(msgBytes);
      const signatureHex = Buffer.from(signature).toString("hex");

      // 3. Verify with backend → get JWT
      const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: keypair.publicKey(),
          challenge,
          signature: signatureHex,
        }),
      });

      if (!verifyRes.ok) throw new Error("Authentication failed");
      const { token, username } = await verifyRes.json();

      // 4. Store JWT
      await AsyncStorage.setItem("auth_token", token);
      if (username) {
        const cached = await AsyncStorage.getItem("cached_profile");
        const profile = cached ? JSON.parse(cached) : {};
        await AsyncStorage.setItem(
          "cached_profile",
          JSON.stringify({ ...profile, username })
        );
      }

      router.replace("/(personal)/home");
    } catch (e) {
      Alert.alert("Sign In Failed", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>
        <BeamPayLogo width={120} height={57} />

        <View style={styles.middle}>
          <View style={styles.iconWrap}>
            <Ionicons name="wallet-outline" size={52} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in with your Stellar wallet to continue
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            title={loading ? "Signing in…" : "Sign In with Wallet"}
            onPress={signIn}
            loading={loading}
            style={styles.primaryBtn}
            textStyle={styles.primaryBtnText}
          />
          <TouchableOpacity
            style={styles.newWalletBtn}
            onPress={() => router.push("/account-type")}
            activeOpacity={0.7}
          >
            <Text style={styles.newWalletText}>
              Don't have a wallet?{" "}
              <Text style={{ fontFamily: "Outfit_700Bold", color: COLORS.primary }}>
                Create one
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    justifyContent: "space-between",
  },
  middle: { alignItems: "center", gap: 16 },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.gray,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  footer: { gap: 16 },
  primaryBtn: { height: 58, borderRadius: 100, backgroundColor: COLORS.primary },
  primaryBtnText: { fontSize: 17, fontFamily: "Outfit_700Bold" },
  newWalletBtn: { alignItems: "center", paddingVertical: 8 },
  newWalletText: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: "#666",
  },
});
