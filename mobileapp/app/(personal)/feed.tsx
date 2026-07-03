/**
 * Social Feed Screen — BeamPay's PayPal/Venmo-style payment feed.
 * Shows public payments with likes and comments.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../src/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080";

interface FeedItem {
  id: string;
  tx_hash: string;
  sender_username: string;
  receiver_username: string;
  amount: string;
  currency: string;
  memo: string;
  visibility: string;
  likes_count: number;
  comments_count: number;
  has_liked: boolean;
  created_at: string;
}

async function authHeaders() {
  const token = await AsyncStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Feed card ─────────────────────────────────────────────────────────────────

const FeedCard = ({
  item,
  onLike,
  onComment,
}: {
  item: FeedItem;
  onLike: (id: string, liked: boolean) => void;
  onComment: (id: string) => void;
}) => {
  return (
    <View style={cardStyles.card}>
      {/* Avatars + names */}
      <View style={cardStyles.header}>
        <View style={cardStyles.avatarRow}>
          <View style={[cardStyles.avatar, { backgroundColor: COLORS.primary }]}>
            <Text style={cardStyles.avatarText}>
              {item.sender_username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={cardStyles.arrowWrap}>
            <Ionicons name="arrow-forward" size={14} color="#999" />
          </View>
          <View style={[cardStyles.avatar, { backgroundColor: COLORS.secondary }]}>
            <Text style={[cardStyles.avatarText, { color: COLORS.primary }]}>
              {item.receiver_username.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={cardStyles.time}>{timeAgo(item.created_at)}</Text>
      </View>

      {/* Payment description */}
      <Text style={cardStyles.description}>
        <Text style={cardStyles.username}>{item.sender_username}</Text>
        {" paid "}
        <Text style={cardStyles.username}>{item.receiver_username}</Text>
      </Text>

      {/* Amount */}
      <View style={cardStyles.amountRow}>
        <Text style={cardStyles.amount}>
          {item.currency} {item.amount}
        </Text>
        {item.visibility === "PUBLIC" && (
          <View style={cardStyles.publicBadge}>
            <Ionicons name="globe-outline" size={11} color="#16A34A" />
            <Text style={cardStyles.publicText}>Public</Text>
          </View>
        )}
      </View>

      {/* Memo */}
      {item.memo ? (
        <View style={cardStyles.memoRow}>
          <Ionicons name="chatbubble-outline" size={13} color="#999" />
          <Text style={cardStyles.memo}>{item.memo}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={cardStyles.actions}>
        <TouchableOpacity
          style={cardStyles.actionBtn}
          onPress={() => onLike(item.id, item.has_liked)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.has_liked ? "heart" : "heart-outline"}
            size={20}
            color={item.has_liked ? COLORS.secondary : "#999"}
          />
          {item.likes_count > 0 && (
            <Text style={[cardStyles.actionCount, item.has_liked && { color: COLORS.secondary }]}>
              {item.likes_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={cardStyles.actionBtn}
          onPress={() => onComment(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#999" />
          {item.comments_count > 0 && (
            <Text style={cardStyles.actionCount}>{item.comments_count}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={cardStyles.actionBtn} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={18} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: "Outfit_700Bold",
    color: "#FFF",
  },
  arrowWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  time: {
    fontSize: 12,
    fontFamily: "Outfit_400Regular",
    color: "#bbb",
  },
  description: {
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: "#444",
    marginBottom: 8,
  },
  username: {
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  amount: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  publicText: {
    fontSize: 11,
    fontFamily: "Outfit_500Medium",
    color: "#16A34A",
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  memo: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: "#555",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: {
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
    color: "#999",
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const loadFeed = useCallback(async (tab: "public" | "friends" = activeTab) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/feed/${tab}?limit=20`, { headers });
      if (!res.ok) throw new Error();
      const data: FeedItem[] = await res.json();
      setFeed(data);
    } catch {
      setFeed([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadFeed(activeTab);
    }, [activeTab])
  );

  const handleLike = async (id: string, alreadyLiked: boolean) => {
    // Optimistic update
    setFeed((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              has_liked: !alreadyLiked,
              likes_count: alreadyLiked
                ? item.likes_count - 1
                : item.likes_count + 1,
            }
          : item
      )
    );
    try {
      const headers = await authHeaders();
      if (alreadyLiked) {
        await fetch(`${API_BASE}/api/social/unlike`, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ payment_id: id }),
        });
      } else {
        await fetch(`${API_BASE}/api/social/like`, {
          method: "POST",
          headers,
          body: JSON.stringify({ payment_id: id }),
        });
      }
    } catch {
      // Revert on failure
      setFeed((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                has_liked: alreadyLiked,
                likes_count: alreadyLiked
                  ? item.likes_count + 1
                  : item.likes_count - 1,
              }
            : item
        )
      );
    }
  };

  const handleSubmitComment = async () => {
    if (!commentTarget || !commentText.trim()) return;
    setCommenting(true);
    try {
      const headers = await authHeaders();
      await fetch(`${API_BASE}/api/social/comment`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          payment_id: commentTarget,
          content: commentText.trim(),
        }),
      });
      setFeed((prev) =>
        prev.map((item) =>
          item.id === commentTarget
            ? { ...item, comments_count: item.comments_count + 1 }
            : item
        )
      );
      setCommentText("");
      setCommentTarget(null);
    } catch {
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setCommenting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        {/* Tabs */}
        <View style={styles.tabs}>
          {(["public", "friends"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Feed list */}
      {loading ? (
        <ActivityIndicator
          color={COLORS.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              onLike={handleLike}
              onComment={(id) => setCommentTarget(id)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadFeed(activeTab);
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No payments here yet</Text>
              <Text style={styles.emptySubtext}>
                {activeTab === "friends"
                  ? "Add friends to see their payments"
                  : "Be the first to make a payment!"}
              </Text>
            </View>
          }
        />
      )}

      {/* Comment sheet */}
      {commentTarget && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.commentSheet}>
            <View style={styles.commentInput}>
              <TextInput
                style={styles.commentTextInput}
                placeholder="Write a comment…"
                placeholderTextColor="#bbb"
                value={commentText}
                onChangeText={setCommentText}
                autoFocus
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentSendBtn,
                  !commentText.trim() && { opacity: 0.4 },
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || commenting}
              >
                {commenting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.commentCancel}
              onPress={() => { setCommentTarget(null); setCommentText(""); }}
            >
              <Text style={styles.commentCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#F8F9FA",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Outfit_700Bold",
    color: COLORS.primary,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#EFEFEF",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "#888",
  },
  tabTextActive: { color: "#FFF" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: "Outfit_600SemiBold",
    color: "#aaa",
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    color: "#ccc",
    textAlign: "center",
  },
  commentSheet: {
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    padding: 12,
    gap: 8,
  },
  commentInput: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Outfit_400Regular",
    color: COLORS.primary,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  commentCancel: { alignItems: "center", paddingVertical: 4 },
  commentCancelText: {
    fontSize: 14,
    fontFamily: "Outfit_500Medium",
    color: "#999",
  },
});
