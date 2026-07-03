/**
 * Platform-aware HMAC-SHA512 utility.
 * - Web: uses the browser's built-in SubtleCrypto API
 * - Native (iOS/Android): uses react-native-quick-crypto for performance
 */
import { Platform } from "react-native";
import { Buffer } from "buffer";

export async function hmacSha512(
  key: Uint8Array | Buffer,
  data: Uint8Array | Buffer
): Promise<Buffer> {
  if (Platform.OS === "web") {
    // Use Web Crypto API (available in all modern browsers)
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const result = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return Buffer.from(result);
  } else {
    // Native: react-native-quick-crypto (synchronous, faster)
    const { createHmac } = require("react-native-quick-crypto");
    const hmac = createHmac("sha512", Buffer.from(key));
    hmac.update(Buffer.from(data));
    const result = hmac.digest() as unknown as Uint8Array;
    return Buffer.from(result);
  }
}
