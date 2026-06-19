import { tryDecryptBlob } from "./crypto.js";
import { sleep } from "./utils.js";

// DOM Elements
const decryptFormContainer = document.getElementById("decrypt-form-container");
const expiredErrorContainer = document.getElementById("expired-error-container");
const decryptForm = document.getElementById("decrypt-form");
const passwordInput = document.getElementById("receiver-password");
const togglePasswordBtn = document.getElementById("toggle-receiver-password");
const openBtn = document.getElementById("open-btn");
const passwordError = document.getElementById("receiver-password-error");

// Global memory for parsed payloads
let decryptedParts = null;

// Initialization Flow
function init() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    showExpiredError();
    return;
  }

  // Parse and validate Standard Hash (e.g. v1.blobA.blobB)
  const parts = hash.split(".");
  if (parts.length === 3 && parts[0] === "v1" && parts[1] && parts[2]) {
    decryptedParts = {
      blobX: parts[1],
      blobY: parts[2]
    };
    showDecryptForm();
  } else {
    showExpiredError();
  }
}

function showDecryptForm() {
  decryptFormContainer.style.display = "block";
  expiredErrorContainer.style.display = "none";
  passwordInput.focus();
}

function showExpiredError() {
  decryptFormContainer.style.display = "none";
  expiredErrorContainer.style.display = "block";
}

// Show/Hide password toggler
togglePasswordBtn.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePasswordBtn.textContent = type === "password" ? "Show" : "Hide";
});

// Decrypt form submission handler
decryptForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!decryptedParts) return;
  
  const enteredPassword = passwordInput.value;
  if (!enteredPassword) return;

  // Set loading UI
  openBtn.disabled = true;
  const originalText = openBtn.textContent;
  openBtn.innerHTML = '<span class="spinner"></span> Opening...';
  passwordError.style.display = "none";

  const { blobX, blobY } = decryptedParts;

  try {
    // Attempt parallel decryption of both blobs
    const [resultX, resultY] = await Promise.all([
      tryDecryptBlob(blobX, enteredPassword),
      tryDecryptBlob(blobY, enteredPassword),
    ]);

    const destination = resultX ?? resultY;

    if (destination) {
      // Remove hash from browser history before redirecting to prevent leakage
      history.replaceState(null, "", window.location.pathname);
      window.location.replace(destination);
    } else {
      // Brute-force friction: wait 800ms
      await sleep(800);
      
      openBtn.disabled = false;
      openBtn.textContent = originalText;
      passwordError.textContent = "Invalid password.";
      passwordError.style.display = "block";
      
      // Clear and autofocus password
      passwordInput.value = "";
      passwordInput.focus();
    }
  } catch (err) {
    await sleep(800);
    openBtn.disabled = false;
    openBtn.textContent = originalText;
    passwordError.textContent = "Invalid password.";
    passwordError.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
  }
});

// Run Page Init
init();
