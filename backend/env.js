import path from "node:path";
import { fileURLToPath } from "node:url";
// Loads backend/.env (SMTP_URL, MAIL_FROM, VIMEO_TOKEN, ...) when present
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env")); } catch { /* no .env */ }
