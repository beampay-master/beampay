import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Buffer } from "buffer";
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
import React from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Platform } from "react-native";
import { COLORS } from "../src/constants/colors";
import { AuthProvider } from "../src/context/AuthContext";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { ToastManager } from "../src/components/Toast";
import { useOfflineDetection } from "../src/hooks/useNetworkStatus";
import {
  getStoredNotificationPreference,
  handleNotificationResponse,
  initNotificationCategoriesAsync,
  registerForPushNotificationsAsync,
} from "../src/services/notificationService";
import * as Notifications from "expo-notifications";
import "../src/locales/i18n"; // Initialize i18n
import { logNavigation, startNavigation } from "../src/utils/performance";

// expo-notifications is not supported on web
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function LayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  useOfflineDetection();

  React.useEffect(() => {
    startNavigation(pathname);
    return () => {
      logNavigation(pathname);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    async function setupNotifications() {
      await initNotificationCategoriesAsync();

      const enabled = await getStoredNotificationPreference();
      if (enabled) {
        await registerForPushNotificationsAsync();
      }
    }

    setupNotifications();
  }, []);

  React.useEffect(() => {
    if (Platform.OS === "web") return;

    const receivedListener = Notifications.addNotificationReceivedListener(
      () => {
        // Receipt can be used for analytics or local display enhancements.
      }
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response, router);
      });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.white },
        }}
      >
        {/* Auth screens */}
        <Stack.Screen name="login" />

        {/* Existing screens */}
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding-start" />
        <Stack.Screen name="account-type/index" />
        <Stack.Screen name="create-wallet" />
        <Stack.Screen name="backup-key" />
        <Stack.Screen name="password" />
        <Stack.Screen name="biometric" />
        <Stack.Screen name="username" />

        {/* Secure key management screens — Issue #97 */}
        <Stack.Screen
          name="mnemonic-backup"
          options={{
            // Prevent swipe-back while the phrase is visible
            gestureEnabled: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="wallet-recovery"
          options={{
            gestureEnabled: true,
            animation: "slide_from_right",
          }}
        />

        {/* Non-critical info screens — deferred animation for faster perceived load */}
        <Stack.Screen name="faq" options={{ animation: "fade" }} />
        <Stack.Screen name="terms-of-service" options={{ animation: "fade" }} />
        <Stack.Screen name="privacy-policy" options={{ animation: "fade" }} />
        <Stack.Screen name="about-beampay" options={{ animation: "fade" }} />
        <Stack.Screen name="help-support" options={{ animation: "fade" }} />

        {/* PayPal-style core screens */}
        <Stack.Screen name="send" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="request" options={{ animation: "slide_from_right" }} />
      </Stack>
      <ToastManager />
    </View>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LayoutContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
