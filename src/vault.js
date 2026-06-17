let activeVaultKey = null;
const STORAGE_KEY = "dl_vault_v1";
const SALT_KEY = "dl_vault_salt";

async function deriveVaultKey(pin, salt) {
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await window.crypto.subtle.importKey(
    "raw", pinBytes, "PBKDF2", false, ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function isVaultSetup() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export async function initVault(pin, initialDuressPassword = "open") {
  let saltString = localStorage.getItem(SALT_KEY);
  let salt;
  if (!saltString) {
    salt = window.crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(
      SALT_KEY,
      btoa(String.fromCharCode(...salt))
    );
  } else {
    salt = Uint8Array.from(atob(saltString), c => c.charCodeAt(0));
  }
  activeVaultKey = await deriveVaultKey(pin, salt);
  const base = {
    duressPassword: initialDuressPassword,
    duressPasswordUpdatedAt: new Date().toISOString(),
    savedDecoys: [],
    preferences: {
      autoWikipedia: true,
      autoDuressPassword: true,
    },
  };
  await saveVaultData(base);
}

export async function unlockVault(pin) {
  const saltString = localStorage.getItem(SALT_KEY);
  if (!saltString) return false;
  const salt = Uint8Array.from(
    atob(saltString), c => c.charCodeAt(0)
  );
  activeVaultKey = await deriveVaultKey(pin, salt);
  const data = await getVaultData();
  return data !== null;
}

async function getVaultData() {
  if (!activeVaultKey) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      activeVaultKey,
      ct
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

async function saveVaultData(obj) {
  if (!activeVaultKey) throw new Error("Vault not unlocked");
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    activeVaultKey,
    new TextEncoder().encode(JSON.stringify(obj))
  );
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  let binary = "";
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  localStorage.setItem(STORAGE_KEY, btoa(binary));
}

export async function getDuressPassword() {
  const v = await getVaultData();
  return v ? v.duressPassword : "open";
}

export async function hasDuressPassword() {
  const v = await getVaultData();
  return v !== null;
}

export async function getDuressPasswordMeta() {
  // Returns metadata only — never the password value itself
  const v = await getVaultData();
  if (!v) return { isSet: false, updatedAt: null };
  return {
    isSet: true,
    updatedAt: v.duressPasswordUpdatedAt ?? null,
  };
}

export async function setDuressPassword(newPassword) {
  const v = await getVaultData();
  if (v) {
    v.duressPassword = newPassword;
    v.duressPasswordUpdatedAt = new Date().toISOString();
    await saveVaultData(v);
    newPassword = null;
  }
}

export async function resetDuressPassword() {
  const v = await getVaultData();
  if (v) {
    v.duressPassword = "open";
    v.duressPasswordUpdatedAt = new Date().toISOString();
    await saveVaultData(v);
  }
}

export async function getSavedDecoys() {
  const v = await getVaultData();
  return v ? v.savedDecoys : [];
}

export async function addDecoy(url, label) {
  const v = await getVaultData();
  if (v) {
    v.savedDecoys.push({
      id: crypto.randomUUID(),
      url,
      label,
      usageCount: 0,
      lastUsedAt: null,
    });
    await saveVaultData(v);
  }
}

export async function removeDecoy(id) {
  const v = await getVaultData();
  if (v) {
    v.savedDecoys = v.savedDecoys.filter(d => d.id !== id);
    await saveVaultData(v);
  }
}

export async function incrementDecoyUsage(id) {
  const v = await getVaultData();
  if (v) {
    const d = v.savedDecoys.find(x => x.id === id);
    if (d) {
      d.usageCount++;
      d.lastUsedAt = new Date().toISOString();
      await saveVaultData(v);
    }
  }
}

export async function getPreferences() {
  const v = await getVaultData();
  return v ? v.preferences : { autoWikipedia: true, autoDuressPassword: true };
}

export async function setPreference(key, value) {
  const v = await getVaultData();
  if (v) {
    v.preferences[key] = value;
    await saveVaultData(v);
  }
}

export async function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
  activeVaultKey = null;
}
