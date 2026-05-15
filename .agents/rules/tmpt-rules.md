---
trigger: always_on
---

# Antigravity Rules: TMPT Platform & BRANKAS

## 1. Project Overview & Core Philosophy
- **Domain**: tmpt.my.id
- **Architecture**: 100% Client-side, Static Web App, Zero-Knowledge, Local-First.
- **ABSOLUTE RULE**: NEVER write server-side code (Node.js, Python, Django, etc.). NEVER write database queries (SQL, MongoDB). All data processing and storage MUST happen entirely within the user's browser. Do not send data to any external server.

## 2. Technology Stack & Constraints
- **CSS Framework**: **PicoCSS** (`picocss.com`). Rely on semantic HTML and PicoCSS's classless design. Avoid custom CSS unless absolutely necessary (store overrides in `/shared/app.css`).
- **Interactivity**: **HTMX** and **Vanilla JavaScript** (ES6+). Do NOT use heavy frontend frameworks like React, Vue, or Svelte.
- **Cryptography**: Strictly use the native browser **Web Crypto API** (PBKDF2 for key derivation, AES-256-GCM for encryption/decryption). Do NOT use or suggest external crypto libraries like CryptoJS.
- **State Management**: Use `localStorage` for persistent encrypted vault data and `sessionStorage` for temporary authentication state.
- **Icons**: Tabler Icons (via SVG sprite).
- **Build Tool**: None. Keep all files runnable directly in the browser (unless Vite is explicitly requested for bundling).

## 3. Security & Authentication Rules
- **Zero-Knowledge Principle**: Master passwords and encryption keys MUST NEVER be written to disk, sent via network, or `console.log`-ed. Keys only live in RAM or `sessionStorage` while the vault is unlocked.
- **Strict Terminology (Bahasa Indonesia)**:
  - Do NOT use "Register" or "Sign Up". Always use "Buat Vault Baru".
  - Do NOT use "Login" or "Sign In". Always use "Buka Vault".
  - Do NOT use "Logout". Always use "Kunci Vault".
- **No Recovery**: NEVER implement a "Forgot Password" or recovery flow that sends data externally.

## 4. File Structure & Component Guidelines
When writing or modifying code, adhere to this shared architecture:
- **UI/Layout**: `/shared/header.html`, `/shared/footer.html`, `/shared/app-header.html`.
- **Core Logic Modules**: 
  - `/shared/crypto.js` (Web Crypto API functions)
  - `/shared/auth.js` (Session, lock/unlock logic)
  - `/shared/vault.js` (CRUD operations for encrypted data)
  - `/shared/backup.js` (Import/export logic)
  - `/shared/ui.js` (Toasts, modals)

## 5. Agent Execution Policy
- When asked to create a new page, automatically wrap the content in a standard PicoCSS `<main class="container">` layout.
- When writing JavaScript logic, ensure it is modular and handles asynchronous Web Crypto API calls properly using `async/await`.
- If a user prompts for a feature that requires a backend (e.g., user accounts, cloud database sync), WARN the user that this violates the PRD's offline/zero-knowledge philosophy before proceeding.

## 6. Development
- Development using Windows 11 with PowerShell, so if you run something, use PowerShell compatible
