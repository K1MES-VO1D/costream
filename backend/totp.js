import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dir } from "./store.js";

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) compatible with Google Authenticator, Authy, 1Password...
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32encode = (buf) => {
  let bits = "", out = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
};
const b32decode = (s) => {
  let bits = "";
  for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
};
export const newSecret = () => b32encode(crypto.randomBytes(20));
const codeAt = (secret, step) => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", b32decode(secret)).update(msg).digest();
  const o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
};
// Returns the matched time step (or null); the caller rejects steps it has already seen (replay protection)
export const matchStep = (secret, code, afterStep = 0) => {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1])
    if (step > afterStep && crypto.timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step;
  return null;
};
export const otpauth = (email, secret) =>
  `otpauth://totp/Difonti:${encodeURIComponent(email)}?secret=${secret}&issuer=Difonti&algorithm=SHA1&digits=6&period=30`;

// Secrets are encrypted at rest with a random key kept next to the database (owner-only file)
const keyFile = path.join(dir, ".totp-key");
const key = fs.existsSync(keyFile)
  ? Buffer.from(fs.readFileSync(keyFile, "utf8"), "hex")
  : (() => { const k = crypto.randomBytes(32); fs.writeFileSync(keyFile, k.toString("hex"), { mode: 0o600 }); return k; })();
export const seal = (text) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};
export const unseal = (s) => {
  const [iv, tag, enc] = s.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
};
