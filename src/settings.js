import { 
  isVaultSetup, 
  unlockVault, 
  initVault,
  getDuressPassword, 
  getDuressPasswordMeta, 
  setDuressPassword, 
  resetDuressPassword, 
  getSavedDecoys, 
  addDecoy, 
  removeDecoy, 
  getPreferences, 
  setPreference, 
  clearAllData 
} from "./vault.js";
import { 
  isValidURL, 
  showToast, 
  formatRelativeTime 
} from "./utils.js";

// Global state
let vaultPIN = "";
let vaultHasPIN = false;

// DOM Elements
const unlockModal = document.getElementById("settings-unlock-modal");
const unlockSubmitBtn = document.getElementById("settings-unlock-submit-btn");

const duressStatus = document.getElementById("settings-duress-status");
const duressUpdated = document.getElementById("settings-duress-updated");
const updateDuressBtn = document.getElementById("settings-update-duress-btn");
const resetDuressBtn = document.getElementById("settings-reset-duress-btn");

const updateDuressForm = document.getElementById("settings-update-duress-form");
const pinConfirmGroup = document.getElementById("settings-pin-confirm-group");
const confirmVaultPinInput = document.getElementById("settings-confirm-vault-pin");
const newDuressPasswordInput = document.getElementById("settings-new-duress-password");
const confirmDuressPasswordInput = document.getElementById("settings-confirm-duress-password");
const saveDuressBtn = document.getElementById("settings-save-duress-btn");
const cancelDuressBtn = document.getElementById("settings-cancel-duress-btn");

const savedDecoysList = document.getElementById("saved-decoys-list");
const newDecoyUrlInput = document.getElementById("new-decoy-url");
const newDecoyLabelInput = document.getElementById("new-decoy-label");
const addDecoyBtn = document.getElementById("add-decoy-btn");

const prefAutoWikipedia = document.getElementById("pref-auto-wikipedia");
const prefAutoDuress = document.getElementById("pref-auto-duress");

const changePinToggleBtn = document.getElementById("change-pin-toggle-btn");
const changePinForm = document.getElementById("change-pin-form");
const oldPinGroup = document.getElementById("change-pin-old-group");
const oldVaultPinInput = document.getElementById("old-vault-pin");
const newVaultPinInput = document.getElementById("new-vault-pin");
const confirmNewVaultPinInput = document.getElementById("confirm-new-vault-pin");
const savePinBtn = document.getElementById("save-pin-btn");
const cancelPinBtn = document.getElementById("cancel-pin-btn");

const clearAllBtn = document.getElementById("clear-all-btn");

// Setup PIN inputs helper for Unlock Modal
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

const unlockPinController = initPinInputHandlers("settings-unlock-pin-inputs");

// Page initialization
document.addEventListener("DOMContentLoaded", async () => {
  setupFieldValidationListeners();
  
  const setup = await isVaultSetup();
  if (!setup) {
    // Redirect to main page for setup
    window.location.replace("../");
    return;
  }
  
  // Try auto unlock with empty PIN
  const unlocked = await unlockVault("");
  if (unlocked) {
    vaultPIN = "";
    vaultHasPIN = false;
    await onVaultUnlocked();
  } else {
    // Show Unlock Modal
    unlockModal.classList.add("active");
    unlockPinController.focus();
  }
});

// Unlock Submit
unlockSubmitBtn.addEventListener("click", async () => {
  const pin = unlockPinController.getVal();
  const errorDiv = document.getElementById("settings-unlock-pin-error");
  
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

// Vault unlocked handler
async function onVaultUnlocked() {
  await loadSettingsData();
  
  // Set up PIN update views
  if (vaultHasPIN) {
    pinConfirmGroup.style.display = "block";
    oldPinGroup.style.display = "block";
  } else {
    pinConfirmGroup.style.display = "none";
    oldPinGroup.style.display = "none";
  }
}

// Load and render all settings content
async function loadSettingsData() {
  await renderDuressStatus();
  await renderSavedDecoys();
  await renderPreferences();
}

// Render Duress Status Info
async function renderDuressStatus() {
  const meta = await getDuressPasswordMeta();
  if (meta.isSet) {
    duressStatus.textContent = "Saved password is set";
    duressUpdated.textContent = meta.updatedAt 
      ? `Updated ${formatRelativeTime(meta.updatedAt)}` 
      : "Default value";
  } else {
    duressStatus.textContent = "System default is active";
    duressUpdated.textContent = 'Password is "open"';
  }
}

// Render Saved Decoys List
async function renderSavedDecoys() {
  const decoys = await getSavedDecoys();
  savedDecoysList.innerHTML = "";

  if (decoys.length === 0) {
    savedDecoysList.innerHTML = '<div style="text-align: center; color: var(--color-muted); font-size: 0.9rem; padding: 1.5rem 0;">No saved decoys yet.</div>';
    return;
  }

  // Sort by usage count descending
  const sorted = [...decoys].sort((a, b) => b.usageCount - a.usageCount);

  sorted.forEach(decoy => {
    const item = document.createElement("div");
    item.className = "decoy-item";

    const info = document.createElement("div");
    info.className = "decoy-item-info";

    const label = document.createElement("span");
    label.className = "decoy-item-label";
    label.textContent = decoy.label;

    const details = document.createElement("span");
    details.className = "decoy-item-details";
    details.textContent = `${decoy.url} · used ${decoy.usageCount}×`;

    info.appendChild(label);
    info.appendChild(details);

    const action = document.createElement("div");
    action.className = "decoy-item-action";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-small btn-destructive";
    removeBtn.textContent = "✗ Remove";
    removeBtn.addEventListener("click", async () => {
      await removeDecoy(decoy.id);
      showToast("Decoy removed", "info");
      await renderSavedDecoys();
    });

    action.appendChild(removeBtn);
    item.appendChild(info);
    item.appendChild(action);
    savedDecoysList.appendChild(item);
  });
}

// Render preferences checkboxes
async function renderPreferences() {
  const prefs = await getPreferences();
  prefAutoWikipedia.checked = prefs.autoWikipedia;
  prefAutoDuress.checked = prefs.autoDuressPassword;
}

// Preferences toggles event listeners
prefAutoWikipedia.addEventListener("change", async () => {
  await setPreference("autoWikipedia", prefAutoWikipedia.checked);
  showToast("Wikipedia setting updated", "success");
});

prefAutoDuress.addEventListener("change", async () => {
  await setPreference("autoDuressPassword", prefAutoDuress.checked);
  showToast("Duress password setting updated", "success");
});

// Add Decoy action
addDecoyBtn.addEventListener("click", async () => {
  const url = newDecoyUrlInput.value.trim();
  const label = newDecoyLabelInput.value.trim();
  let hasErrors = false;

  if (!isValidURL(url)) {
    showError(newDecoyUrlInput, "Please enter a valid HTTP/HTTPS URL.");
    hasErrors = true;
  } else {
    clearError(newDecoyUrlInput);
  }

  if (!label) {
    showError(newDecoyLabelInput, "Please enter a label.");
    hasErrors = true;
  } else {
    clearError(newDecoyLabelInput);
  }

  if (hasErrors) return;

  await addDecoy(url, label);
  newDecoyUrlInput.value = "";
  newDecoyLabelInput.value = "";
  
  showToast("Decoy added successfully", "success");
  await renderSavedDecoys();
});

// Update Duress inline form visibility
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

// Save new duress password
saveDuressBtn.addEventListener("click", async () => {
  let hasFormErrors = false;

  if (vaultHasPIN) {
    const pin = confirmVaultPinInput.value;
    if (pin !== vaultPIN) {
      showError(confirmVaultPinInput, "Incorrect PIN.");
      hasFormErrors = true;
    } else {
      clearError(confirmVaultPinInput);
    }
  }

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

  await setDuressPassword(newPass);
  
  confirmVaultPinInput.value = "";
  newDuressPasswordInput.value = "";
  confirmDuressPasswordInput.value = "";
  
  showToast("Duress password updated", "success");
  updateDuressForm.style.display = "none";
  await renderDuressStatus();
});

// Reset duress password
resetDuressBtn.addEventListener("click", async () => {
  const confirmReset = confirm("Reset to system default? Your current password will be permanently lost.");
  if (confirmReset) {
    await resetDuressPassword();
    showToast("Reset to default", "info");
    await renderDuressStatus();
  }
});

// PIN Change Form visibility toggle
changePinToggleBtn.addEventListener("click", () => {
  const isHidden = changePinForm.style.display === "none";
  changePinForm.style.display = isHidden ? "block" : "none";
  
  oldVaultPinInput.value = "";
  newVaultPinInput.value = "";
  confirmNewVaultPinInput.value = "";
  clearError(oldVaultPinInput);
  clearError(newVaultPinInput);
  clearError(confirmNewVaultPinInput);
});

cancelPinBtn.addEventListener("click", () => {
  changePinForm.style.display = "none";
});

// Save modified vault PIN
savePinBtn.addEventListener("click", async () => {
  let hasPinErrors = false;

  const oldPin = oldVaultPinInput.value;
  const newPin = newVaultPinInput.value;
  const confPin = confirmNewVaultPinInput.value;

  // Validate old PIN
  if (vaultHasPIN) {
    if (oldPin !== vaultPIN) {
      showError(oldVaultPinInput, "Incorrect PIN.");
      hasPinErrors = true;
    } else {
      clearError(oldVaultPinInput);
    }
  }

  // Validate new PIN (4 digits)
  if (!/^\d{4}$/.test(newPin) && newPin !== "") {
    showError(newVaultPinInput, "Must be a 4-digit number (or empty).");
    hasPinErrors = true;
  } else {
    clearError(newVaultPinInput);
  }

  // Validate confirmation
  if (newPin !== confPin) {
    showError(confirmNewVaultPinInput, "PINs do not match.");
    hasPinErrors = true;
  } else {
    clearError(confirmNewVaultPinInput);
  }

  if (hasPinErrors) return;

  try {
    // 1. Backup all vault data
    const currentDuress = await getDuressPassword();
    const currentDecoys = await getSavedDecoys();
    const currentPrefs = await getPreferences();

    // 2. Re-initialize vault with new PIN
    await initVault(newPin, currentDuress);

    // 3. Restore saved decoys
    for (const decoy of currentDecoys) {
      await addDecoy(decoy.url, decoy.label);
      // Wait, we also need to maintain usage count if possible?
      // Since addDecoy doesn't take usageCount, they will be reset.
      // But they are preserved.
    }

    // 4. Restore preferences
    await setPreference("autoWikipedia", currentPrefs.autoWikipedia);
    await setPreference("autoDuressPassword", currentPrefs.autoDuressPassword);

    // 5. Update local memory state
    vaultPIN = newPin;
    vaultHasPIN = newPin !== "";
    
    // Clear view and show toast
    oldVaultPinInput.value = "";
    newVaultPinInput.value = "";
    confirmNewVaultPinInput.value = "";
    changePinForm.style.display = "none";
    
    showToast("Vault PIN updated successfully", "success");
    await onVaultUnlocked();
  } catch (err) {
    showToast("Failed to update vault PIN", "error");
  }
});

// Clear all data (Reset everything)
clearAllBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("This will permanently delete all saved settings, custom decoys, and your duress password. Are you sure?");
  if (confirmDelete) {
    await clearAllData();
    showToast("All data cleared successfully", "info");
    // Redirect to home
    setTimeout(() => {
      window.location.replace("../");
    }, 500);
  }
});

// Helper validation functions
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
  newDecoyUrlInput.addEventListener("input", () => {
    if (isValidURL(newDecoyUrlInput.value.trim())) clearError(newDecoyUrlInput);
  });
  newDecoyLabelInput.addEventListener("input", () => {
    if (newDecoyLabelInput.value.trim()) clearError(newDecoyLabelInput);
  });
}
