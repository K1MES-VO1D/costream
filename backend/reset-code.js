// Usage (in Termux):  node backend/reset-code.js --list        shows registered emails
//                     node backend/reset-code.js <email>       prints a one-time reset code (15 min)
// Passwords are stored as one-way hashes, so they cannot be read back, only reset.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const dir = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const dbFile = path.join(dir, "db.json");
if (!fs.existsSync(dbFile)) { console.error("Geen database gevonden in", dir); process.exit(1); }
const db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
const users = Object.values(db.users);
const arg = (process.argv[2] || "").trim().toLowerCase();

if (!arg || arg === "--list") {
  console.log(users.length ? users.map((u) => `${u.email}  (${u.name})`).join("\n") : "Nog geen accounts.");
  console.log("\nGebruik: node backend/reset-code.js <email>");
  process.exit(0);
}
if (!users.some((u) => u.email === arg)) { console.error("Geen account met dit e-mailadres. Zie --list."); process.exit(1); }

const code = Array.from(crypto.randomBytes(8), (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31]).join("");
const file = path.join(dir, "resets.json");
let resets = {};
try { resets = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
resets[arg] = { hash: crypto.createHash("sha256").update(code).digest("hex"), exp: Date.now() + 15 * 60_000, tries: 0 };
fs.writeFileSync(file, JSON.stringify(resets), { mode: 0o600 });
console.log(`\nResetcode voor ${arg}:  ${code}\n\nGeldig 15 minuten. Open de app > Inloggen > Wachtwoord vergeten en vul deze code in.`);
