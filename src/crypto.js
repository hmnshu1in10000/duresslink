const PBKDF2_ITERATIONS = 310000;
const SALT_SEED = new TextEncoder().encode("duresslink-v1-public-salt");

async function deriveKey(password) {
  const passwordBytes = new TextEncoder().encode(password);
  const baseKey = await window.crypto.subtle.importKey(
    "raw", passwordBytes, "PBKDF2", false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT_SEED,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBlob(payload, password) {
  const key = await deriveKey(password);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedPayload = new TextEncoder().encode(payload);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, encodedPayload
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  let binary = "";
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function tryDecryptBlob(blob, password) {
  try {
    const binaryString = atob(blob.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await deriveKey(password);
    const plaintextBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, key, ciphertext
    );
    return new TextDecoder().decode(plaintextBuffer);
  } catch {
    return null;
  }
}

export async function generateHashString(
  realURL, realPass, decoyURL, duressPass
) {
  const blobA = await encryptBlob(realURL, realPass);
  const blobB = await encryptBlob(decoyURL, duressPass);
  const blobs = [blobA, blobB];
  const randomByte = window.crypto.getRandomValues(new Uint8Array(1))[0];
  if (randomByte % 2 === 0) blobs.reverse();
  return `v1.${blobs[0]}.${blobs[1]}`;
}

export function wipe(obj) {
  if (obj && obj.value !== undefined) obj.value = "";
  obj = null;
}
