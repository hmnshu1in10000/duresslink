# SecureNote (DuressLink)

A static, zero-knowledge, client-side-only dual-password link protection tool. 

Public Branding: **SecureNote — Private link sharing**  
Internal Code Name: **DuressLink**

---

## Project Overview

SecureNote allows you to encrypt a sensitive URL behind a "real" password, while simultaneously encrypting an innocent "decoy" URL (such as a random Wikipedia article) behind a fake "duress" password. Both payloads are encrypted using standard Web Cryptography APIs and bundled into a single shareable link containing the base64url-encoded encrypted payloads.

When the receiver opens the link, they see a single generic password input field. 
* Entering the **real password** decrypts and redirects to the **real URL**.
* Entering the **duress password** decrypts and redirects to the **decoy URL**.

An outside observer cannot determine whether two payloads exist or distinguish which password was used.

---

## Security Guarantees & Implementation

1. **Zero-Knowledge & Client-Side Only**: Cryptographic key derivation (PBKDF2) and AES-GCM encryption/decryption are executed entirely in the user's browser. No data is sent to a backend server.
2. **History Leakage Prevention**: When a link is decrypted, the page removes the cryptographic hash from the browser history using `history.replaceState` immediately before executing the redirection. This prevents the secret hash from being preserved in browser navigation history.
3. **Memory Scrubbing**: To mitigate memory exposure, all sensitive variables, including cleartext passwords and keys, are explicitly cleared or set to `null` immediately after the cryptographic operations complete.
4. **Uniform Friction/Timing Protection**: Failed decryption attempts trigger an 800ms delay to deter brute-force key search probing and prevent timing analysis.
5. **No Fingerprinting**: The vault local encryption PIN relies strictly on a randomly generated salt stored locally in browser storage rather than mutable device or browser fingerprints.
6. **Crawler Prevention**: Search engine indexers are instructed via `public/robots.txt` to ignore all decryption `/open/` pages and `/settings/` sections.

---

## File Structure

```
/
├── index.html                  # Generator UI
├── open/
│   └── index.html              # Receiver/Decryption UI
├── settings/
│   └── index.html              # Settings and Decoy Manager UI
├── src/
│   ├── crypto.js               # Cryptographic algorithms (PBKDF2 / AES-GCM)
│   ├── wikipedia.js            # Wikipedia API live fetching with CORS support
│   ├── vault.js                # Encrypted LocalStorage vault
│   ├── generator.js            # Controller for link generation
│   ├── receiver.js             # Controller for link decryption
│   ├── settings.js             # Controller for settings and configuration
│   ├── defaults.js             # Shared system default parameters
│   └── utils.js                # Shared DOM & Helper utilities
├── styles/
│   └── main.css                # Dark clinical minimalist style
└── public/
    ├── favicon.ico             # Clean tab icon
    └── robots.txt              # Search engine crawler constraints
```

---

## Running Locally

SecureNote is a purely static web application that requires **no build steps, node modules, or npm configuration**. All imports are modern ECMAScript (ES) modules loaded directly by the browser.

To run it locally:
1. Open the project folder in terminal.
2. Run any static HTTP server, for example:
   * **Python 3**: `python -m http.server 8000`
   * **NodeJS**: `npx serve` or `npx live-server`
3. Navigate to `http://localhost:8000` in your web browser.

---

## Deployment

Structure is 100% compatible with zero-configuration static hosting platforms:
* **Cloudflare Pages**: Link the GitHub repository and select "No Build Step" or static output.
* **Netlify**: Set build command to empty and publish directory to the root directory `/`.
* **GitHub Pages**: Deploy directly from the main/master branch root directory.
