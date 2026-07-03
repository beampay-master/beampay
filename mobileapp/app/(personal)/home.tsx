/**
 * BeamPay Home Screen — PayPal-style clean layout.
 * Shows balance, 4 quick actions, and recent transactions.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../src/constants/colors";
import { getLocalKeypair, getAccountBalance } from "../../src/services/stellarWallet";
import { fetchTransactions } from "../../src/services/transactionService";
import { Transaction } from "../../src/types/transaction";
import { formatDate } from "../../src/utils/formatting";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  bg: string;
  iconColor: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "send",
    icon: "arrow-up-circle",
    label: "Send",
    route: "/send",
    bg: COLORS.primary,
    iconColor: COLORS.secondary,
  },
  {
    id: "request",
    icon: "arrow-down-circle",
    label: "Request",
    route: "/request",
    bg: "#F0FDF4",
    iconColor: COLORS.primary,
  },
  {
    id: "receive",
    icon: "qr-code",
    label: "Receive",
    route: "/receive",
    bg: "#F0FDF4",
    iconColor: COLORS.primary,
  },
  {
    id: "fund",
    icon: "add-circle",
    label: "Add Money",
    route: "/fund",
    bg: "#F0FDF4",
    iconColor: COLORS.primary,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeIcon(type: Transaction["type"]) {
  switch (type) {
    case "sent":
      return { name: "arrow-up" as const, bg: "#FFEBEE", color: "#EF4444" };
    case "received":
      return { name: "arrow-down" as const, bg: "#E8F5E9", color: "#22C55E" };
    case "yield":
      return { name: "trending-up" as const, bg: "#F0FDF4", color: "#16A34A" };
    default:
      return { name: "swap-horizontal" as const, bg: "#E3F2FD", color: "#2196F3" };
  }
}

function amountColor(type: Transaction["type"]): string {
  if (type === "received" || type === "yield") return "#22C55E";
  return COLORS.primary;
}

function amountPrefix(type: Transaction["type"]): string {
  if (type === "received" || type === "yield") return "+";
  return "−";
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ActionBtn = ({
  action,
  onPress,
}: {
  action: QuickAction;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
      <Ionicons name={action.icon} size={26} color={action.iconColor} />
    </View>
    <Text style={styles.actionLabel}>{action.label}</Text>
  </TouchableOpacity>
);

const TxRow = ({
  item,
  onPress,
}: {
  item: Transaction;
  onPress: () => void;
}) => {
  const icon = typeIcon(item.type);
  const label = item.addressLabel ?? `${item.address.slice(0, 6)}…${item.address.slice(-4)}`;
  const time = formatDate(item.timestamp, {
    month: "short",
    day: "numeric",
  });

  return (
    <TouchableOpacity style={styles.txRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.txIcon, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={18} color={icon.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.txTime}>{time}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor(item.type) }]}>
          {amountPrefix(item.type)}{item.amount} {item.asset}
        </Text>
        {item.status !== "completed" && (
          <Text
            style={[
              styles.txStatus,
              { color: item.status === "pending" ? "#F59E0B" : "#EF4444" },
            ]}
          >
            {item.status}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("User");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const balanceAnim = useRef(new Animated.Value(1)).current;

  // Load profile from storage/cache
  const loadProfile = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem("cached_profile");
      if (cached) {
        const p = JSON.parse(cached);
        if (p.username) setUsername(p.username);
        if (p.displayName) setDisplayName(p.displayName);
      }
      // Also check legacy profile cache from onboarding
      const legacyProfile = await AsyncStorage.getItem("user_profile");
      if (legacyProfile) {
        const p = JSON.parse(legacyProfile);
        if (p.displayName) setDisplayName(p.displayName);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load wallet balance from Stellar
  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const kp = await getLocalKeypair();
      if (kp) {
        const balances = await getAccountBalance(kp.publicKey());
        // Find USDC first, then USDT, then XLM
        const usdc = balances.find((b) => b.asset === "USDC");
        const usdt = balances.find((b) => b.asset === "USDT");
        const xlm = balances.find((b) => b.asset === "XLM");
        const primary = usdc ?? usdt ?? xlm ?? null;
        if (primary) {
          const formatted = parseFloat(primary.balance).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setBalance(`${primary.asset} ${formatted}`);
        } else {
          setBalance("$0.00");
        }
      } else {
        setBalance("$0.00");
      }
    } catch {
      setBalance("$0.00");
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Load recent transactions (last 5)
  const loadRecentTx = useCallback(async () => {
    setTxLoading(true);
    try {
      const page = await fetchTransactions(
        { type: "all", status: "all", search: "" },
        null
      );
      setRecentTx(page.items.slice(0, 5));
    } catch {
      // keep empty
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadBalance();
    loadRecentTx();
  }, [loadProfile, loadBalance, loadRecentTx]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadBalance(), loadRecentTx()]);
    setRefreshing(false);
  }, [loadProfile, loadBalance, loadRecentTx]);

  const toggleBalanceHidden = () => {
    Animated.sequence([
      Animated.timing(balanceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(balanceAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setBalanceHidden((h) => !h);
  };

  const greeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayedName = displayName ?? username;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.username}>{displayedName}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => router.push("/(personal)/settings")}
          accessibilityLabel="Open settings"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayedName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLabelRow}>
            <Text style={styles.balanceLabelText}>Total Balance</Text>
            <TouchableOpacity onPress={toggleBalanceHidden} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={balanceHidden ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>
          </View>

          <Animated.View style={{ opacity: balanceAnim }}>
            {balanceLoading ? (
              <ActivityIndicator color={COLORS.secondary} style={{ marginVertical: 8 }} />
            ) : (
              <Text style={styles.balanceAmount}>
                {balanceHidden ? "••••••" : (balance ?? "$0.00")}
              </Text>
            )}
          </Animated.View>

          <Text style={styles.balanceSubtitle}>Available to send</Text>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <ActionBtn
              key={action.id}
              action={action}
              onPress={() => router.push(action.route as any)}
            />
          ))}
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/(personal)/history")}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          {txLoading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginTop: 24 }}
            />
          ) : recentTx.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Send or receive money to get started.
              </Text>
            </View>
          ) : (
            recentTx.map((tx) => (
              <TxRow
                key={tx.id}
                item={tx}
                onPress={() => router.push(`/transaction/${tx.id}` as any)}
              />
            ))
          )}
        </View>

        {/* ── Promo Banner: Earn while you hold ── */}
        <TouchableOpacity
          style={styles.promoBanner}
          activeOpacity={0.85}
          onPress={() => router.push("/yield-transaction" as any)}
        >
          <View style={styles.promoIcon}>
            <Ionicons name="trending-up" size={22} color="#16A34A" />
          </View>
          <View style={styles.promoText}>
            <Text style={styles.promoTitle}>Earn up to 8.75% APY</Text>
            <Text style={styles.promoSubtitle}>
              Your balance works for you automatically
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#16A34A" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#F8F9FA",
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "#777",
  },
  username: {
    fontSize: 20,
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
    marginTop: 1,
  },
  avatarBtn: {},
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: COLORS.secondary,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Balance card
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  balanceLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabelText: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  balanceAmount: {
    fontSize: 42,
    fontFamily: "Outfit_700Bold",
    color: COLORS.secondary,
    marginBottom: 6,
  },
  balanceSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "rgba(255,255,255,0.55)",
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  actionBtn: {
    alignItems: "center",
    flex: 1,
  },
  actionIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: "Outfit_600SemiBold",
    color: COLORS.primary,
  },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
  },
  sectionLink: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: COLORS.primary,
    opacity: 0.6,
  },

  // Transaction row
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txLabel: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: COLORS.primary,
    marginBottom: 3,
  },
  txTime: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: "#999",
  },
  txRight: { alignItems: "flex-end" },
  txAmount: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
  },
  txStatus: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    textTransform: "capitalize",
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    color: "#aaa",
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Outfit_400Regular",
    color: "#bbb",
    textAlign: "center",
  },

  // Promo banner
  promoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 12,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  promoText: { flex: 1 },
  promoTitle: {
    fontSize: 14,
    fontFamily: "Outfit_700Bold",
    color: "#15803D",
  },
  promoSubtitle: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: "#16A34A",
    marginTop: 2,
  },
});
