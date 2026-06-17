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

// Parse hash on page load
const hash = window.location.hash.slice(1);
const parts = hash ? hash.split(".") : [];
const isValidHash = hash && parts.length === 3 && parts[0] === "v1" && parts[1] && parts[2];

if (!isValidHash) {
  decryptFormContainer.style.display = "none";
  expiredErrorContainer.style.display = "block";
} else {
  // Autofocus the password field for immediate interaction
  passwordInput.focus();
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
  
  if (!isValidHash) return;
  
  const enteredPassword = passwordInput.value;
  if (!enteredPassword) return;

  // Set loading UI
  openBtn.disabled = true;
  const originalText = openBtn.textContent;
  openBtn.innerHTML = '<span class="spinner"></span> Opening...';
  passwordError.style.display = "none";

  const blobX = parts[1];
  const blobY = parts[2];

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
