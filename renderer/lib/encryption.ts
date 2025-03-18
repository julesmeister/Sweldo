import crypto from "crypto";

// This key should be stored securely in environment variables in production
const ENCRYPTION_KEY = "sweldo-secure-key-32-bytes-long!!"; // 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

// Create a buffer of exact length needed for AES-256
const getKey = () => {
  // Use SHA256 to generate a 32-byte key from our string
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
};

export function encryptPinCode(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV and encrypted data as hex strings
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt PIN code");
  }
}

export function decryptPinCode(text: string): string {
  try {
    const [ivHex, encryptedHex] = text.split(":");
    if (!ivHex || !encryptedHex) {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = getKey();

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt PIN code");
  }
}
