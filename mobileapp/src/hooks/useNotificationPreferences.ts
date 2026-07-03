import { useCallback, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import {
  getStoredNotificationPreference,
  removeStoredPushToken,
  registerForPushNotificationsAsync,
  requestNotificationPermissionsAsync,
  saveNotificationPreference,
} from "../services/notificationService";

// expo-notifications doesn't support web — PermissionStatus enum is undefined there.
const UNDETERMINED: Notifications.PermissionStatus =
  (Notifications.PermissionStatus?.UNDETERMINED as Notifications.PermissionStatus) ??
  ("undetermined" as Notifications.PermissionStatus);

const isWeb = Platform.OS === "web";

export function useNotificationPreferences() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus>(UNDETERMINED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      const stored = await getStoredNotificationPreference();
      setEnabled(stored);

      if (!isWeb) {
        try {
          const current = await Notifications.getPermissionsAsync();
          setPermissionStatus(current.status);
        } catch {
          setPermissionStatus(UNDETERMINED);
        }
      } else {
        setPermissionStatus(UNDETERMINED);
      }

      setLoading(false);
    }

    loadPreferences();
  }, []);

  const toggleNotifications = useCallback(async (value: boolean) => {
    await saveNotificationPreference(value);
    setEnabled(value);

    if (isWeb) return; // notifications not supported on web

    if (value) {
      try {
        const status = await requestNotificationPermissionsAsync();
        setPermissionStatus(status);
        if (status === Notifications.PermissionStatus?.GRANTED) {
          await registerForPushNotificationsAsync();
        } else if (status === Notifications.PermissionStatus?.DENIED) {
          await Linking.openSettings();
        }
      } catch {
        // ignore on web / unsupported platforms
      }
    } else {
      await removeStoredPushToken();
      try {
        const current = await Notifications.getPermissionsAsync();
        setPermissionStatus(current.status);
      } catch {
        setPermissionStatus(UNDETERMINED);
      }
    }
  }, []);

  const openSystemSettings = useCallback(async () => {
    if (!isWeb) {
      await Linking.openSettings();
    }
  }, []);

  return {
    enabled,
    permissionStatus,
    loading,
    toggleNotifications,
    openSystemSettings,
  };
}
