import { 
  generateHashString, 
  wipe 
} from "./crypto.js";
import { 
  getDecoy 
} from "./wikipedia.js";
import { 
  isVaultSetup, 
  initVault, 
  unlockVault, 
  getDuressPassword, 
  getDuressPasswordMeta, 
  setDuressPassword, 
  resetDuressPassword, 
  getSavedDecoys, 
  incrementDecoyUsage 
} from "./vault.js";
import { 
  isValidURL, 
  copyToClipboard, 
  showToast, 
  sleep, 
  formatRelativeTime,
  sendPayloadToCloud
} from "./utils.js";

// Global state
let currentDecoy = null;
let vaultPIN = ""; // Empty if skipped, stores the unlocked PIN otherwise
let vaultHasPIN = false;
let generatedHash = "";

// DOM Elements
const setupModal = document.getElementById("setup-modal");
const unlockModal = document.getElementById("unlock-modal");
const setupContinueBtn = document.getElementById("setup-continue-btn");
const setupSkipBtn = document.getElementById("setup-skip-btn");
const unlockSubmitBtn = document.getElementById("unlock-submit-btn");

const realUrlInput = document.getElementById("real-url");
const realPasswordInput = document.getElementById("real-password");
const toggleRealPasswordBtn = document.getElementById("toggle-real-password");

const toggleAutoDecoy = document.getElementById("toggle-auto-decoy");
const autoDecoyContainer = document.getElementById("auto-decoy-container");
const autoDecoyTitle = document.getElementById("auto-decoy-title");
const autoDecoyUrl = document.getElementById("auto-decoy-url");
const regenerateDecoyBtn = document.getElementById("regenerate-decoy-btn");
const editDecoyBtn = document.getElementById("edit-decoy-btn");

const manualDecoyContainer = document.getElementById("manual-decoy-container");
const decoyUrlInput = document.getElementById("decoy-url");
const savedDecoySelect = document.getElementById("saved-decoy-select");

const toggleAutoDuress = document.getElementById("toggle-auto-duress");
const autoDuressContainer = document.getElementById("auto-duress-container");
const duressStatusTitle = document.getElementById("duress-status-title");
const duressStatusUpdated = document.getElementById("duress-status-updated");
const updateDuressBtn = document.getElementById("update-duress-btn");
const resetDuressBtn = document.getElementById("reset-duress-btn");

const updateDuressForm = document.getElementById("update-duress-form");
const pinConfirmGroup = document.getElementById("pin-confirm-group");
const confirmVaultPinInput = document.getElementById("confirm-vault-pin");
const newDuressPasswordInput = document.getElementById("new-duress-password");
const confirmDuressPasswordInput = document.getElementById("confirm-duress-password");
const saveDuressBtn = document.getElementById("save-duress-btn");
const cancelDuressBtn = document.getElementById("cancel-duress-btn");

const manualDuressContainer = document.getElementById("manual-duress-container");
const oneTimeDuressInput = document.getElementById("one-time-duress");
const toggleOneTimeDuressBtn = document.getElementById("toggle-one-time-duress");

const generateBtn = document.getElementById("generate-btn");
const outputContainer = document.getElementById("output-container");
const outputLink = document.getElementById("output-link");
const copyLinkBtn = document.getElementById("copy-link-btn");
const shareLinkBtn = document.getElementById("share-link-btn");
const toggleShorten = document.getElementById("toggle-shorten");

// Setup PIN inputs helper
function initPinInputHandlers(containerId) {
  const container = document.getElementById(containerId);
  const inputs = container.querySelectorAll(".pin-input");
  
  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "");
      if (input.value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && input.value.length === 0 && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = "";
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 4);
      for (let i = 0; i < pasteData.length; i++) {
        if (inputs[i]) {
          inputs[i].value = pasteData[i];
          if (inputs[i + 1]) inputs[i + 1].focus();
        }
      }
    });
  });

  return {
    getVal: () => Array.from(inputs).map(i => i.value).join(""),
    clear: () => inputs.forEach(i => i.value = ""),
    focus: () => inputs[0].focus()
  };
}

const setupPinController = initPinInputHandlers("setup-pin-inputs");
const unlockPinController = initPinInputHandlers("unlock-pin-inputs");

// Page initialization
document.addEventListener("DOMContentLoaded", async () => {
  setupFieldValidationListeners();
  
  const setup = await isVaultSetup();
  if (!setup) {
    // Show Setup Modal
    setupModal.classList.add("active");
    setupPinController.focus();
  } else {
    // Attempt auto-unlock with empty PIN (skipped vault setup)
    const unlocked = await unlockVault("");
    if (unlocked) {
      vaultPIN = "";
      vaultHasPIN = false;
      await onVaultUnlocked();
    } else {
      // Show Unlock Modal since vault was encrypted with a PIN
      unlockModal.classList.add("active");
      unlockPinController.focus();
    }
  }
});

// Setup Modal action: Continue
setupContinueBtn.addEventListener("click", async () => {
  const pin = setupPinController.getVal();
  const errorDiv = document.getElementById("setup-pin-error");
  
  if (pin.length !== 4) {
    errorDiv.style.display = "block";
    return;
  }
  errorDiv.style.display = "none";
  
  try {
    await initVault(pin);
    vaultPIN = pin;
    vaultHasPIN = true;
    setupModal.classList.remove("active");
    showToast("Vault configured successfully", "success");
    await onVaultUnlocked();
  } catch (err) {
    showToast("Failed to initialize vault", "error");
  }
});

// Setup Modal action: Skip for now
setupSkipBtn.addEventListener("click", async () => {
  try {
    await initVault("");
    vaultPIN = "";
    vaultHasPIN = false;
    setupModal.classList.remove("active");
    showToast("Vault configured without PIN", "info");
    await onVaultUnlocked();
  } catch (err) {
    showToast("Failed to initialize vault", "error");
  }
});

// Unlock Modal action: Submit
unlockSubmitBtn.addEventListener("click", async () => {
  const pin = unlockPinController.getVal();
  const errorDiv = document.getElementById("unlock-pin-error");
  
  if (pin.length !== 4) {
    errorDiv.textContent = "Please enter your 4-digit PIN.";
    errorDiv.style.display = "block";
    return;
  }
  
  const unlocked = await unlockVault(pin);
  if (unlocked) {
    vaultPIN = pin;
    vaultHasPIN = true;
    errorDiv.style.display = "none";
    unlockModal.classList.remove("active");
    showToast("Vault unlocked", "success");
    await onVaultUnlocked();
  } else {
    errorDiv.textContent = "Incorrect PIN. Please try again.";
    errorDiv.style.display = "block";
    unlockPinController.clear();
    unlockPinController.focus();
  }
});

// Post-unlock workflow
async function onVaultUnlocked() {
  await fetchWikipediaDecoy();
  await loadSavedDecoysDropdown();
  await updateDuressStatusDisplay();
  
  // Clean vault pin confirm input view if required
  if (vaultHasPIN) {
    pinConfirmGroup.style.display = "block";
  } else {
    pinConfirmGroup.style.display = "none";
  }
}

// Fetch a Wikipedia decoy
async function fetchWikipediaDecoy() {
  autoDecoyTitle.textContent = "Fetching decoy...";
  autoDecoyUrl.textContent = "Please wait";
  regenerateDecoyBtn.disabled = true;
  
  currentDecoy = await getDecoy();
  
  autoDecoyTitle.textContent = currentDecoy.title;
  autoDecoyUrl.textContent = currentDecoy.url;
  regenerateDecoyBtn.disabled = false;
}

// Load saved decoys list into dropdown (sorted by usage descending)
async function loadSavedDecoysDropdown() {
  const decoys = await getSavedDecoys();
  const sorted = [...decoys].sort((a, b) => b.usageCount - a.usageCount);
  
  // Clear other than default option
  savedDecoySelect.innerHTML = '<option value="">-- No saved decoy selected --</option>';
  
  sorted.forEach(decoy => {
    const option = document.createElement("option");
    option.value = decoy.url;
    // Embed dataset info for access count/id
    option.dataset.id = decoy.id;
    option.textContent = `${decoy.label} (${decoy.url}) [Used ${decoy.usageCount}x]`;
    savedDecoySelect.appendChild(option);
  });
}

// Update Duress status UI
async function updateDuressStatusDisplay() {
  const meta = await getDuressPasswordMeta();
  if (meta.isSet) {
    duressStatusTitle.textContent = "Saved password is set";
    duressStatusUpdated.textContent = meta.updatedAt 
      ? `Updated ${formatRelativeTime(meta.updatedAt)}` 
      : "Default value";
  } else {
    duressStatusTitle.textContent = "System default is active";
    duressStatusUpdated.textContent = 'Password is "open"';
  }
}

// Toggles & visibility handlers
toggleRealPasswordBtn.addEventListener("click", () => {
  const type = realPasswordInput.type === "password" ? "text" : "password";
  realPasswordInput.type = type;
  toggleRealPasswordBtn.textContent = type === "password" ? "Show" : "Hide";
});

toggleOneTimeDuressBtn.addEventListener("click", () => {
  const type = oneTimeDuressInput.type === "password" ? "text" : "password";
  oneTimeDuressInput.type = type;
  toggleOneTimeDuressBtn.textContent = type === "password" ? "Show" : "Hide";
});

toggleAutoDecoy.addEventListener("change", () => {
  if (toggleAutoDecoy.checked) {
    autoDecoyContainer.style.display = "flex";
    manualDecoyContainer.style.display = "none";
  } else {
    autoDecoyContainer.style.display = "none";
    manualDecoyContainer.style.display = "block";
    loadSavedDecoysDropdown();
  }
  clearError(decoyUrlInput);
});

regenerateDecoyBtn.addEventListener("click", fetchWikipediaDecoy);

editDecoyBtn.addEventListener("click", () => {
  if (currentDecoy) {
    decoyUrlInput.value = currentDecoy.url;
    toggleAutoDecoy.checked = false;
    autoDecoyContainer.style.display = "none";
    manualDecoyContainer.style.display = "block";
    decoyUrlInput.focus();
  }
});

toggleAutoDuress.addEventListener("change", () => {
  if (toggleAutoDuress.checked) {
    autoDuressContainer.style.display = "flex";
    manualDuressContainer.style.display = "none";
  } else {
    autoDuressContainer.style.display = "none";
    manualDuressContainer.style.display = "block";
  }
  updateDuressForm.style.display = "none";
  clearError(oneTimeDuressInput);
});

toggleShorten.addEventListener("change", () => {
  if (toggleShorten.checked) {
    generateBtn.textContent = "Generate & Shorten Link";
  } else {
    generateBtn.textContent = "Generate Secure Link";
  }
});

// Inline Duress Update Form
updateDuressBtn.addEventListener("click", () => {
  updateDuressForm.style.display = "block";
  confirmVaultPinInput.value = "";
  newDuressPasswordInput.value = "";
  confirmDuressPasswordInput.value = "";
  clearError(confirmVaultPinInput);
  clearError(newDuressPasswordInput);
  clearError(confirmDuressPasswordInput);
});

cancelDuressBtn.addEventListener("click", () => {
  updateDuressForm.style.display = "none";
});

saveDuressBtn.addEventListener("click", async () => {
  let hasFormErrors = false;

  // PIN validation
  if (vaultHasPIN) {
    const pin = confirmVaultPinInput.value;
    if (pin !== vaultPIN) {
      showError(confirmVaultPinInput, "Incorrect PIN.");
      hasFormErrors = true;
    } else {
      clearError(confirmVaultPinInput);
    }
  }

  // Password validation
  const newPass = newDuressPasswordInput.value;
  const confPass = confirmDuressPasswordInput.value;

  if (!newPass) {
    showError(newDuressPasswordInput, "Please enter a password.");
    hasFormErrors = true;
  } else {
    clearError(newDuressPasswordInput);
  }

  if (newPass !== confPass) {
    showError(confirmDuressPasswordInput, "Passwords do not match.");
    hasFormErrors = true;
  } else {
    clearError(confirmDuressPasswordInput);
  }

  if (hasFormErrors) return;

  // Perform secure save
  await setDuressPassword(newPass);
  
  // Wipe inputs
  confirmVaultPinInput.value = "";
  newDuressPasswordInput.value = "";
  confirmDuressPasswordInput.value = "";
  
  showToast("Duress password updated", "success");
  updateDuressForm.style.display = "none";
  await updateDuressStatusDisplay();
});

// Reset Duress password to default
resetDuressBtn.addEventListener("click", async () => {
  const confirmReset = confirm("Reset to system default? Your current password will be permanently lost.");
  if (confirmReset) {
    await resetDuressPassword();
    showToast("Reset to default", "info");
    await updateDuressStatusDisplay();
  }
});

// Error Display helpers
function showError(inputEl, msg) {
  const errEl = document.getElementById(`${inputEl.id}-error`);
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = "block";
  }
}

function clearError(inputEl) {
  const errEl = document.getElementById(`${inputEl.id}-error`);
  if (errEl) {
    errEl.style.display = "none";
  }
}

function setupFieldValidationListeners() {
  realUrlInput.addEventListener("input", () => {
    if (isValidURL(realUrlInput.value)) clearError(realUrlInput);
  });
  realPasswordInput.addEventListener("input", () => {
    if (realPasswordInput.value.length >= 8) clearError(realPasswordInput);
  });
  decoyUrlInput.addEventListener("input", () => {
    if (isValidURL(decoyUrlInput.value)) clearError(decoyUrlInput);
  });
  oneTimeDuressInput.addEventListener("input", () => {
    if (oneTimeDuressInput.value && oneTimeDuressInput.value !== realPasswordInput.value) {
      clearError(oneTimeDuressInput);
    }
  });
}

// Main generation validation
function validateInputs() {
  let isValid = true;
  
  // Real URL
  if (!isValidURL(realUrlInput.value)) {
    showError(realUrlInput, "Please enter a valid HTTP/HTTPS URL.");
    isValid = false;
  } else {
    clearError(realUrlInput);
  }

  // Real Password
  if (realPasswordInput.value.length < 8) {
    showError(realPasswordInput, "Password must be at least 8 characters.");
    isValid = false;
  } else {
    clearError(realPasswordInput);
  }

  // Decoy URL
  if (!toggleAutoDecoy.checked) {
    const decoyUrl = decoyUrlInput.value || savedDecoySelect.value;
    if (!isValidURL(decoyUrl)) {
      showError(decoyUrlInput, "Please enter or select a valid HTTP/HTTPS URL.");
      isValid = false;
    } else {
      clearError(decoyUrlInput);
    }
  }

  // Duress Password
  if (!toggleAutoDuress.checked) {
    const duressVal = oneTimeDuressInput.value;
    if (!duressVal) {
      showError(oneTimeDuressInput, "Please enter a custom duress password.");
      isValid = false;
    } else if (duressVal === realPasswordInput.value) {
      showError(oneTimeDuressInput, "Duress password must be different from real password.");
      isValid = false;
    } else {
      clearError(oneTimeDuressInput);
    }
  }

  return isValid;
}

// Generate link action
generateBtn.addEventListener("click", async () => {
  if (!validateInputs()) return;

  // UI state loading
  generateBtn.disabled = true;
  const originalText = generateBtn.textContent;
  generateBtn.innerHTML = '<span class="spinner"></span> Encrypting...';
  outputContainer.style.display = "none";

  // Capture variables
  const realURL = realUrlInput.value;
  let realPass = realPasswordInput.value;
  
  let decoyURL = "";
  let decoyId = null;
  if (toggleAutoDecoy.checked) {
    decoyURL = currentDecoy.url;
  } else {
    decoyURL = decoyUrlInput.value || savedDecoySelect.value;
    // Detect if from saved decoy selection
    if (savedDecoySelect.selectedIndex > 0) {
      decoyId = savedDecoySelect.options[savedDecoySelect.selectedIndex].dataset.id;
    }
  }

  let duressPass = "";
  if (toggleAutoDuress.checked) {
    duressPass = await getDuressPassword();
  } else {
    duressPass = oneTimeDuressInput.value;
  }

  try {
    // Delay slightly to let loading spinner render properly before heavy PBKDF2 executes
    await sleep(50);
    
    generatedHash = await generateHashString(realURL, realPass, decoyURL, duressPass);
    
    let finalHash = generatedHash;
    if (toggleShorten.checked) {
      generateBtn.innerHTML = '<span class="spinner"></span> Shortening...';
      const pasteID = await sendPayloadToCloud(generatedHash);
      finalHash = pasteID;
    }

    // Construct absolute target URL
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const secureLink = `${window.location.origin}${basePath}/open/#${finalHash}`;
    
    // Render
    outputLink.textContent = secureLink;
    outputContainer.style.display = "block";
    
    // Auto copy
    const copied = await copyToClipboard(secureLink);
    if (copied) {
      showToast("Link generated and copied to clipboard!", "success");
    } else {
      showToast("Link generated!", "success");
    }

    // Increment decoy usage count if saved
    if (decoyId) {
      await incrementDecoyUsage(decoyId);
    }
  } catch (err) {
    console.error("Link generation error:", err);
    showToast("Failed to generate link.", "error");
  } finally {
    // Security Scrubbing
    realPass = "";
    duressPass = "";
    wipe(realPasswordInput);
    wipe(oneTimeDuressInput);
    
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
});

// Copy Output Link
copyLinkBtn.addEventListener("click", async () => {
  if (outputLink.textContent) {
    const copied = await copyToClipboard(outputLink.textContent);
    if (copied) {
      showToast("Link copied to clipboard", "success");
    } else {
      showToast("Failed to copy link", "error");
    }
  }
});

// Share Output Link
shareLinkBtn.addEventListener("click", async () => {
  const url = outputLink.textContent;
  if (!url) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "SecureNote",
        text: "Please open this secure link.",
        url: url
      });
    } catch (_) {
      // User canceled share
    }
  } else {
    showToast("Sharing not supported by browser. Link copied instead.", "info");
    await copyToClipboard(url);
  }
});
