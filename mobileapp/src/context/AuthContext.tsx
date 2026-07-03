/**
 * AuthContext — lightweight global auth state.
 * Reads JWT + profile from AsyncStorage on mount and exposes them app-wide.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserProfile {
  address: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  balance: string; // available balance as display string e.g. "$320.45"
}

interface AuthState {
  token: string | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.beampay.app";

const AuthContext = createContext<AuthState>({
  token: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("auth_token");
      if (!stored) {
        setLoading(false);
        return;
      }
      setToken(stored);

      // Try to fetch fresh profile from API
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${stored}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const p: UserProfile = {
          address: data.address ?? "",
          username: data.username ?? "",
          displayName: data.display_name ?? null,
          avatarUrl: data.avatar_url ?? null,
          balance: "0.00", // balance comes from Stellar, keep 0 as default
        };
        setProfile(p);
        await AsyncStorage.setItem("cached_profile", JSON.stringify(p));
      } else {
        // Offline: load cached profile
        const cached = await AsyncStorage.getItem("cached_profile");
        if (cached) setProfile(JSON.parse(cached));
      }
    } catch {
      // Offline fallback
      const cached = await AsyncStorage.getItem("cached_profile");
      if (cached) setProfile(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([
      "auth_token",
      "cached_profile",
      "stellar_keypair",
    ]);
    setToken(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, profile, loading, signOut, refreshProfile: loadFromStorage }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
