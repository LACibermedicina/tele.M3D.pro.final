import fs from "fs";
import path from "path";

/**
 * Secrets persisted by the /instalar installer are stored in a local,
 * git-ignored JSON file. Real environment variables always take priority:
 * values from this file are only applied when the variable is not already
 * set in the process environment. This module must be imported before any
 * module that reads credentials at import time (e.g. server/paypal.ts).
 */

const SECRETS_DIR = path.join(process.cwd(), ".installer");
const SECRETS_FILE = path.join(SECRETS_DIR, "secrets.json");

// Whitelist of env vars the installer is allowed to manage.
export const INSTALLER_MANAGED_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "AGORA_APP_ID",
  "AGORA_APP_CERTIFICATE",
  "STRIPE_SECRET_KEY",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_MODE",
  "PAGBANK_TOKEN",
  "PAGBANK_EMAIL",
  "PAGBANK_SANDBOX",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
] as const;

export type InstallerManagedKey = (typeof INSTALLER_MANAGED_KEYS)[number];

function readSecretsFile(): Record<string, string> {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return {};
    const raw = fs.readFileSync(SECRETS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const key of INSTALLER_MANAGED_KEYS) {
        if (typeof parsed[key] === "string" && parsed[key].length > 0) {
          out[key] = parsed[key];
        }
      }
      return out;
    }
  } catch (error) {
    console.error("Failed to read installer secrets file:", error);
  }
  return {};
}

export function persistInstallerSecrets(values: Partial<Record<InstallerManagedKey, string>>): void {
  const existing = readSecretsFile();
  const merged: Record<string, string> = { ...existing };
  for (const [key, value] of Object.entries(values)) {
    if (!INSTALLER_MANAGED_KEYS.includes(key as InstallerManagedKey)) continue;
    if (typeof value === "string" && value.length > 0) {
      merged[key] = value;
    }
  }
  fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(SECRETS_FILE, 0o600);
  } catch {
    /* best effort */
  }
}

export function loadPersistedInstallerSecrets(): void {
  const stored = readSecretsFile();
  for (const [key, value] of Object.entries(stored)) {
    // Env vars remain the priority source; only fill in what's missing.
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load immediately at import time so downstream modules see the values.
loadPersistedInstallerSecrets();
