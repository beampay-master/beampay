/**
 * BeamPay Request Screen — PayPal-style request money.
 * Generates a shareable payment link / QR with amount pre-filled.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { COLORS } from "../src/constants/colors";
import { Button } from "../src/components/Button";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Step indicator ────────────────────────────────────────────────────────────

const Steps = ({ current }: { current: number }) => (
  <View style={styles.steps}>
    {[0, 1].map((i) => (
      <View
        key={i}
        style={[styles.stepDot, i <= current && styles.stepDotActive]}
      />
    ))}
  </View>
);

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RequestScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [username, setUsername] = useState("me");
  const [copied, setCopied] = useState(false);

  // Load username once
  React.useEffect(() => {
    (async () => {
      const cached = await AsyncStorage.getItem("cached_profile");
      if (cached) {
        const p = JSON.parse(cached);
        if (p.username) setUsername(p.username);
      }
    })();
  }, []);

  const paymentLink = `https://beampay.app/pay/${username}${amount ? `?amount=${amount}` : ""}${note ? `&note=${encodeURIComponent(note)}` : ""}`;

  const next = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(1);
  };

  const back = () => {
    if (step === 0) { router.back(); return; }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(0);
  };

  const handleCopy = () => {
    Clipboard.setString(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me ${amount ? `$${amount} ` : ""}on BeamPay!\n${paymentLink}`,
        url: paymentLink,
      });
    } catch { /* ignore */ }
  };

  // ── Step 0: Amount + note ───────────────────────────────────────────────────

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Request Money</Text>
      <Text style={styles.stepSubtitle}>
        Set an amount and share your BeamPay link
      </Text>

      {/* Amount */}
      <View style={styles.amountDisplay}>
        <Text style={styles.amountCurrency}>$</Text>
        <Text style={styles.amountValue}>{amount || "0"}</Text>
      </View>

      {/* Numeric keypad */}
      <View style={styles.keypad}>
        {[["1","2","3"],["4","5","6"],["7","8","9"],[".", "0","⌫"]].map(
          (row, ri) => (
            <View style={styles.keypadRow} key={ri}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.keypadKey}
                  onPress={() => {
                    if (key === "⌫") {
                      setAmount((p) => p.slice(0, -1));
                    } else if (key === "." && amount.includes(".")) {
                      return;
                    } else {
                      const parts = amount.split(".");
                      if (parts[1] && parts[1].length >= 2) return;
                      setAmount((p) => (p === "0" && key !== "." ? key : p + key));
                    }
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.keypadKeyText}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </View>

      {/* Note chips — quick fill */}
      <Text style={styles.noteChipsLabel}>What's it for?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.noteChipsRow}
      >
        {["Rent", "Groceries", "Dinner", "Transport", "Bills", "Other"].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.noteChip, note === n && styles.noteChipActive]}
            onPress={() => setNote(note === n ? "" : n)}
          >
            <Text style={[styles.noteChipText, note === n && styles.noteChipTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Step 1: Share QR ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {amount ? `Request $${amount}` : "Your Payment Link"}
      </Text>
      <Text style={styles.stepSubtitle}>
        Share the QR or link below to get paid
      </Text>

      {/* QR Code */}
      <View style={styles.qrCard}>
        <QRCode
          value={paymentLink}
          size={200}
          color={COLORS.primary}
          backgroundColor="#FFFFFF"
        />
        <View style={styles.qrUsername}>
          <Text style={styles.qrUsernameText}>{username}</Text>
          <Text style={styles.qrUsernameLabel}>beampay</Text>
        </View>
      </View>

      {/* Link */}
      <View style={styles.linkBox}>
        <Ionicons name="link-outline" size={18} color="#999" />
        <Text style={styles.linkText} numberOfLines={1}>
          {paymentLink}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.shareActions}>
        <TouchableOpacity
          style={[styles.shareBtn, styles.shareBtnOutline]}
          onPress={handleCopy}
          activeOpacity={0.8}
        >
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={20}
            color={copied ? "#16A34A" : COLORS.primary}
          />
          <Text style={[styles.shareBtnText, copied && { color: "#16A34A" }]}>
            {copied ? "Copied!" : "Copy Link"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareBtn, styles.shareBtnFilled]}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color={COLORS.secondary} />
          <Text style={[styles.shareBtnText, { color: COLORS.secondary }]}>
            Share
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reminder card */}
      <View style={styles.reminderCard}>
        <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
        <Text style={styles.reminderText}>
          Anyone with this link can send you{amount ? ` $${amount}` : " money"} directly via BeamPay or any compatible Stellar wallet.
        </Text>
      </View>
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request</Text>
        <Steps current={step} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
        </ScrollView>

        <View style={styles.footer}>
          {step === 0 ? (
            <Button
              title="Generate Request"
              onPress={next}
              style={styles.footerBtn}
            />
          ) : (
            <Button
              title="Done"
              onPress={() => router.replace("/(personal)/home")}
              style={styles.footerBtn}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },
  steps: { flexDirection: "row", gap: 6 },
  stepDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#E0E0E0",
  },
  stepDotActive: { backgroundColor: COLORS.primary },

  scroll: { flexGrow: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  stepTitle: {
    fontSize: 26, fontFamily: "Outfit_700Bold", color: COLORS.primary, marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15, fontFamily: "Outfit_400Regular", color: "#777", marginBottom: 24,
  },

  // Amount
  amountDisplay: {
    flexDirection: "row", alignItems: "flex-end",
    justifyContent: "center", marginBottom: 24, gap: 4,
  },
  amountCurrency: {
    fontSize: 32, fontFamily: "Outfit_400Regular", color: "#aaa", marginBottom: 6,
  },
  amountValue: {
    fontSize: 60, fontFamily: "Outfit_700Bold", color: COLORS.primary, lineHeight: 70,
  },

  // Keypad
  keypad: { gap: 10, marginBottom: 20 },
  keypadRow: { flexDirection: "row", gap: 10 },
  keypadKey: {
    flex: 1, height: 64, backgroundColor: "#F5F5F5",
    borderRadius: 14, justifyContent: "center", alignItems: "center",
  },
  keypadKeyText: {
    fontSize: 24, fontFamily: "Outfit_600SemiBold", color: COLORS.primary,
  },

  // Note chips
  noteChipsLabel: {
    fontSize: 14, fontFamily: "Outfit_600SemiBold", color: "#777", marginBottom: 10,
  },
  noteChipsRow: { gap: 8, paddingBottom: 4 },
  noteChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
  },
  noteChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  noteChipText: {
    fontSize: 13, fontFamily: "Outfit_600SemiBold", color: "#555",
  },
  noteChipTextActive: { color: COLORS.secondary },

  // QR
  qrCard: {
    alignItems: "center", backgroundColor: "#FAFAFA",
    borderRadius: 24, padding: 28, marginBottom: 20,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  qrUsername: { marginTop: 20, alignItems: "center" },
  qrUsernameText: {
    fontSize: 18, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },
  qrUsernameLabel: {
    fontSize: 13, fontFamily: "Outfit_400Regular", color: "#999",
  },

  // Link
  linkBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F5F5", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 8, marginBottom: 20,
  },
  linkText: {
    flex: 1, fontSize: 13, fontFamily: "Outfit_400Regular", color: "#666",
  },

  // Share actions
  shareActions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  shareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", height: 52, borderRadius: 26, gap: 8,
  },
  shareBtnOutline: {
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: "#F0FDF4",
  },
  shareBtnFilled: { backgroundColor: COLORS.primary },
  shareBtnText: {
    fontSize: 15, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },

  // Reminder
  reminderCard: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 10, backgroundColor: "#EFF6FF",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  reminderText: {
    flex: 1, fontSize: 13, fontFamily: "Outfit_400Regular",
    color: "#1D4ED8", lineHeight: 19,
  },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  footerBtn: { height: 56, borderRadius: 28 },
});
