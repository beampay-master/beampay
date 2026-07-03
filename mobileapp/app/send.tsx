/**
 * BeamPay Send Screen — PayPal-style:
 * 1. Who: search by username, email, or crypto address
 * 2. How much + note
 * 3. Confirm
 * 4. Success
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../src/constants/colors";
import { Button } from "../src/components/Button";
import {
  getLocalKeypair,
  submitPayment,
  StellarWalletState,
} from "../src/services/stellarWallet";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  "http://localhost:8080";

interface SearchUser {
  username: string;
  address: string;
  avatar_url: string | null;
}

// ── Step indicator ────────────────────────────────────────────────────────────

const Steps = ({ current }: { current: number }) => (
  <View style={styles.steps}>
    {[0, 1, 2].map((i) => (
      <View
        key={i}
        style={[styles.stepDot, i <= current && styles.stepDotActive]}
      />
    ))}
  </View>
);

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SendScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0 — recipient
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<SearchUser | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1 — amount + note
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Step 2 — confirm + submit
  const [submitting, setSubmitting] = useState(false);
  const [walletState, setWalletState] = useState<StellarWalletState | null>(null);

  useEffect(() => {
    (async () => {
      const kp = await getLocalKeypair();
      if (kp) {
        setWalletState({ publicKey: kp.publicKey(), isConnected: true, source: "local" });
      }
    })();
  }, []);

  // ── Search users ────────────────────────────────────────────────────────────

  const searchUsers = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const res = await fetch(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(q)}&limit=8`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) throw new Error();
      const data: SearchUser[] = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => searchUsers(query), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, searchUsers]);

  // Detect if query looks like a Stellar address (starts with G, 56 chars)
  const isStellarAddress = (s: string) =>
    /^G[A-Z0-9]{55}$/.test(s.trim());

  // ── Navigation ──────────────────────────────────────────────────────────────

  const next = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0) {
      router.back();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep((s) => s - 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!recipient) return;

    if (!walletState?.isConnected) {
      Alert.alert(
        "No Wallet",
        "No wallet found. Please set up your wallet first.",
        [{ text: "OK" }]
      );
      return;
    }

    setSubmitting(true);
    try {
      const { hash } = await submitPayment(
        recipient.address,
        amount,
        walletState.source!,
        walletState.publicKey,
        "USDC",
        undefined,
        note || undefined
      );

      // Post payment to social feed backend so it appears in feed
      const token = await AsyncStorage.getItem("auth_token");
      if (token && hash) {
        await fetch(`${API_BASE}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tx_hash: hash,
            receiver_address: recipient.address,
            amount: Math.round(parseFloat(amount) * 100), // micro-units
            currency: "USDC",
            memo: note || "",
            visibility: "PUBLIC",
          }),
        }).catch(() => {}); // non-fatal if backend is unreachable
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(3); // success
    } catch (e) {
      Alert.alert("Transfer Failed", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 0: Who ─────────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Send to</Text>
      <Text style={styles.stepSubtitle}>
        Search by username, email, or paste a crypto address
      </Text>

      {/* Search input */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Username, email or address"
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (recipient) setRecipient(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => { setQuery(""); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={18} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {/* Use raw Stellar address */}
      {isStellarAddress(query) && (
        <TouchableOpacity
          style={styles.addressCard}
          onPress={() => {
            setRecipient({ username: query.trim(), address: query.trim(), avatar_url: null });
            setSearchResults([]);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.addressIcon}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressCardLabel}>Send to crypto address</Text>
            <Text style={styles.addressCardValue} numberOfLines={1}>
              {query.slice(0, 12)}…{query.slice(-8)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      )}

      {/* Selected recipient chip */}
      {recipient && (
        <View style={styles.selectedChip}>
          <View style={styles.chipAvatar}>
            <Text style={styles.chipAvatarText}>
              {recipient.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chipName}>{recipient.username}</Text>
            <Text style={styles.chipAddress} numberOfLines={1}>
              {recipient.address.slice(0, 10)}…{recipient.address.slice(-6)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setRecipient(null)}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      )}

      {/* Search results */}
      {!recipient && searchResults.length > 0 && (
        <View style={styles.resultsList}>
          {searchResults.map((u) => (
            <TouchableOpacity
              key={u.address}
              style={styles.resultRow}
              onPress={() => {
                setRecipient(u);
                setQuery(u.username);
                setSearchResults([]);
              }}
              activeOpacity={0.75}
            >
              <View style={styles.resultAvatar}>
                <Text style={styles.resultAvatarText}>
                  {u.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{u.username}</Text>
                <Text style={styles.resultAddr} numberOfLines={1}>
                  {u.address.slice(0, 10)}…{u.address.slice(-6)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!recipient && !searching && query.length >= 2 && searchResults.length === 0 && !isStellarAddress(query) && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No users found for "{query}"</Text>
          <Text style={styles.noResultsHint}>
            Try their full username or paste a Stellar address.
          </Text>
        </View>
      )}
    </View>
  );

  // ── Step 1: Amount + Note ───────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How much?</Text>
      <Text style={styles.stepSubtitle}>
        Sending to{" "}
        <Text style={{ fontFamily: "Outfit_700Bold", color: COLORS.primary }}>
          {recipient?.username}
        </Text>
      </Text>

      {/* Big amount display */}
      <View style={styles.amountDisplay}>
        <Text style={styles.amountCurrency}>$</Text>
        <Text style={styles.amountValue}>{amount || "0"}</Text>
      </View>

      {/* Numeric keypad */}
      <View style={styles.keypad}>
        {[["1","2","3"],["4","5","6"],["7","8","9"],[".",  "0", "⌫"]].map(
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
                      // Limit to 2 decimal places
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

      {/* Note */}
      <View style={styles.noteBox}>
        <Ionicons name="chatbubble-outline" size={18} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.noteInput}
          placeholder="What's it for? (optional)"
          placeholderTextColor="#bbb"
          value={note}
          onChangeText={setNote}
          maxLength={100}
        />
      </View>
    </View>
  );

  // ── Step 2: Confirm ─────────────────────────────────────────────────────────

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm payment</Text>

      <View style={styles.confirmCard}>
        {/* Amount big */}
        <View style={styles.confirmAmountWrap}>
          <Text style={styles.confirmAmount}>${amount}</Text>
        </View>

        <View style={styles.confirmDivider} />

        {/* To */}
        <View style={styles.confirmRow}>
          <Text style={styles.confirmRowLabel}>To</Text>
          <View style={styles.confirmRecipient}>
            <View style={styles.confirmAvatar}>
              <Text style={styles.confirmAvatarText}>
                {recipient?.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.confirmRecipientName}>{recipient?.username}</Text>
          </View>
        </View>

        {/* Note */}
        {note ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmRowLabel}>Note</Text>
            <Text style={styles.confirmRowValue}>{note}</Text>
          </View>
        ) : null}

        {/* Network */}
        <View style={styles.confirmRow}>
          <Text style={styles.confirmRowLabel}>Network</Text>
          <Text style={styles.confirmRowValue}>Stellar (USDC)</Text>
        </View>

        {/* Fee */}
        <View style={styles.confirmRow}>
          <Text style={styles.confirmRowLabel}>Fee</Text>
          <Text style={[styles.confirmRowValue, { color: "#16A34A" }]}>~$0.001</Text>
        </View>

        <View style={styles.confirmDivider} />

        {/* Total */}
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmRowLabel, { fontFamily: "Outfit_700Bold", color: COLORS.primary }]}>
            Total
          </Text>
          <Text style={[styles.confirmRowValue, { fontFamily: "Outfit_700Bold", color: COLORS.primary, fontSize: 18 }]}>
            ${amount}
          </Text>
        </View>
      </View>
    </View>
  );

  // ── Step 3: Success ─────────────────────────────────────────────────────────

  const renderSuccess = () => (
    <View style={[styles.stepContent, styles.successContainer]}>
      <View style={styles.successRingOuter}>
        <View style={styles.successRingInner}>
          <View style={styles.successCheck}>
            <Ionicons name="checkmark" size={48} color={COLORS.primary} />
          </View>
        </View>
      </View>

      <Text style={styles.successTitle}>Payment Sent!</Text>
      <Text style={styles.successSubtitle}>
        ${amount} sent to {recipient?.username}
      </Text>

      {note ? (
        <View style={styles.successNote}>
          <Ionicons name="chatbubble-outline" size={14} color="#999" />
          <Text style={styles.successNoteText}>{note}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const canContinue = (): boolean => {
    if (step === 0) return !!recipient;
    if (step === 1) return !!amount && parseFloat(amount) > 0;
    if (step === 2) return !submitting;
    return false;
  };

  const btnLabel = (): string => {
    if (step === 2) return submitting ? "Sending…" : "Send Now";
    if (step === 3) return "Done";
    return "Continue";
  };

  const handleBtn = () => {
    if (step === 2) { handleConfirm(); return; }
    if (step === 3) { router.replace("/(personal)/home"); return; }
    next();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      {step < 3 && (
        <View style={styles.header}>
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Money</Text>
          <Steps current={step} />
        </View>
      )}

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
          {step === 2 && renderStep2()}
          {step === 3 && renderSuccess()}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={btnLabel()}
            onPress={handleBtn}
            disabled={!canContinue() && step !== 3}
            loading={submitting}
            style={styles.footerBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
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
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  stepDotActive: { backgroundColor: COLORS.primary },

  scroll: { flexGrow: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  stepTitle: {
    fontSize: 26, fontFamily: "Outfit_700Bold",
    color: COLORS.primary, marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15, fontFamily: "Outfit_400Regular",
    color: "#777", marginBottom: 24,
  },

  // Search
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F5F5", borderRadius: 14,
    paddingHorizontal: 14, height: 52,
    gap: 10, marginBottom: 16,
  },
  searchInput: {
    flex: 1, fontSize: 16, fontFamily: "Outfit_400Regular",
    color: COLORS.primary,
  },

  // Address card
  addressCard: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#E0E0E0",
    borderRadius: 14, padding: 14, gap: 12,
    marginBottom: 12, backgroundColor: "#FAFAFA",
  },
  addressIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F0F0F0",
    justifyContent: "center", alignItems: "center",
  },
  addressCardLabel: {
    fontSize: 12, fontFamily: "Outfit_400Regular", color: "#777",
  },
  addressCardValue: {
    fontSize: 14, fontFamily: "Outfit_600SemiBold", color: COLORS.primary,
  },

  // Selected chip
  selectedChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0FDF4", borderRadius: 14,
    padding: 12, gap: 10, marginBottom: 8,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  chipAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center", alignItems: "center",
  },
  chipAvatarText: {
    fontSize: 16, fontFamily: "Outfit_700Bold", color: COLORS.secondary,
  },
  chipName: {
    fontSize: 15, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },
  chipAddress: {
    fontSize: 12, fontFamily: "Outfit_400Regular", color: "#777",
  },

  // Results
  resultsList: {
    borderRadius: 14, borderWidth: 1, borderColor: "#E8E8E8",
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F5F5F5",
    gap: 12, backgroundColor: COLORS.white,
  },
  resultAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center", alignItems: "center",
  },
  resultAvatarText: {
    fontSize: 16, fontFamily: "Outfit_700Bold", color: COLORS.secondary,
  },
  resultName: {
    fontSize: 15, fontFamily: "Outfit_600SemiBold", color: COLORS.primary,
  },
  resultAddr: {
    fontSize: 12, fontFamily: "Outfit_400Regular", color: "#999",
  },

  noResults: { paddingTop: 24, alignItems: "center", gap: 6 },
  noResultsText: {
    fontSize: 15, fontFamily: "Outfit_600SemiBold", color: "#999",
  },
  noResultsHint: {
    fontSize: 13, fontFamily: "Outfit_400Regular",
    color: "#bbb", textAlign: "center",
  },

  // Amount
  amountDisplay: {
    flexDirection: "row", alignItems: "flex-end",
    justifyContent: "center", marginBottom: 24, gap: 4,
  },
  amountCurrency: {
    fontSize: 32, fontFamily: "Outfit_400Regular",
    color: "#aaa", marginBottom: 6,
  },
  amountValue: {
    fontSize: 60, fontFamily: "Outfit_700Bold",
    color: COLORS.primary, lineHeight: 70,
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

  // Note
  noteBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F5F5", borderRadius: 14,
    paddingHorizontal: 14, height: 52,
  },
  noteInput: {
    flex: 1, fontSize: 15, fontFamily: "Outfit_400Regular",
    color: COLORS.primary,
  },

  // Confirm card
  confirmCard: {
    backgroundColor: "#FAFAFA", borderRadius: 20,
    borderWidth: 1, borderColor: "#E8E8E8",
    padding: 20, gap: 14, marginTop: 8,
  },
  confirmAmountWrap: { alignItems: "center", paddingVertical: 8 },
  confirmAmount: {
    fontSize: 48, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },
  confirmDivider: { height: 1, backgroundColor: "#F0F0F0" },
  confirmRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  confirmRowLabel: {
    fontSize: 14, fontFamily: "Outfit_400Regular", color: "#777",
  },
  confirmRowValue: {
    fontSize: 15, fontFamily: "Outfit_600SemiBold", color: COLORS.primary,
  },
  confirmRecipient: { flexDirection: "row", alignItems: "center", gap: 8 },
  confirmAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: "center", alignItems: "center",
  },
  confirmAvatarText: {
    fontSize: 13, fontFamily: "Outfit_700Bold", color: COLORS.secondary,
  },
  confirmRecipientName: {
    fontSize: 15, fontFamily: "Outfit_700Bold", color: COLORS.primary,
  },

  // Success
  successContainer: {
    alignItems: "center", justifyContent: "center",
    flex: 1, paddingTop: 60,
  },
  successRingOuter: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: "#E0F2E9",
    justifyContent: "center", alignItems: "center",
    marginBottom: 32,
  },
  successRingInner: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 2, borderColor: COLORS.secondary,
    justifyContent: "center", alignItems: "center",
  },
  successCheck: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.secondary,
    justifyContent: "center", alignItems: "center",
  },
  successTitle: {
    fontSize: 28, fontFamily: "Outfit_700Bold", color: COLORS.primary,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16, fontFamily: "Outfit_400Regular", color: "#666",
    marginBottom: 16,
  },
  successNote: {
    flexDirection: "row", alignItems: "center",
    gap: 6, backgroundColor: "#F5F5F5",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  successNoteText: {
    fontSize: 14, fontFamily: "Outfit_400Regular", color: "#666",
  },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  footerBtn: { height: 56, borderRadius: 28 },
});
