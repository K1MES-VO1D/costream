import "./env.js";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { services, titles, refreshCatalog, loadCache, archiveVideoUrl } from "./catalog.js";
import { db, save, dir as dataDir } from "./store.js";
import QRCode from "qrcode";
import { sendMail, mailEnabled } from "./mailer.js";
import { newSecret, matchStep, otpauth, seal, unseal } from "./totp.js";

const PORT = process.env.PORT || 4000;
const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 30 * 24 * 3600 * 1000;
const STATUSES = ["watching", "planned", "completed", "onhold", "dropped"];

loadCache();
refreshCatalog().catch((e) => console.log("catalog refresh failed:", e.message));
setInterval(() => refreshCatalog().catch(() => {}), 6 * 60 * 60 * 1000).unref();

// ---- password hashing (scrypt, per-user salt, constant-time compare) ----
const hashPassword = async (pw) => {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
};
const verifyPassword = async (pw, stored) => {
  const [, salt, key] = stored.split("$");
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(pw, Buffer.from(salt, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
};
const DUMMY_HASH = await hashPassword("dummy-password-for-timing"); // equalises timing for unknown emails

const passwordProblem = (pw) => {
  if (typeof pw !== "string" || pw.length < 6) return "Wachtwoord moet minstens 6 tekens hebben";
  if (pw.length > 128) return "Wachtwoord mag maximaal 128 tekens hebben";
  return null;
};
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const cleanName = (n) => (typeof n === "string" ? n.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) : "");

// ---- sessions: random opaque tokens, only a SHA-256 hash is stored, revocable ----
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, totp: Boolean(u.totp?.enabled), setupRequired: Boolean(u.setupRequired) });
const sha8 = (t) => sha(t.replace(/[\s-]/g, "").toUpperCase());
// Checks an authenticator code (replay-protected) or a single-use backup code; consumes it on success
const checkSecondFactor = (user, raw) => {
  const code = String(raw ?? "").replace(/[\s-]/g, "").slice(0, 20);
  if (user.totp?.enabled) {
    const step = matchStep(unseal(user.totp.secret), code, user.totp.last || 0);
    if (step) { user.totp.last = step; save(); return true; }
    const h = sha8(code), i = user.totp.backup.indexOf(h);
    if (i >= 0) { user.totp.backup.splice(i, 1); save(); return true; }
  }
  return false;
};
const newSession = (userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  db.sessions[sha(token)] = { userId, exp: Date.now() + SESSION_MS };
  const mine = Object.entries(db.sessions).filter(([, s]) => s.userId === userId).sort((a, b) => a[1].exp - b[1].exp);
  for (const [h] of mine.slice(0, Math.max(0, mine.length - 10))) delete db.sessions[h];
  save();
  return token;
};
const revokeAll = (userId, keepHash) => {
  for (const [h, s] of Object.entries(db.sessions)) if (s.userId === userId && h !== keepHash) delete db.sessions[h];
  save();
};
const purge = () => {
  for (const [h, s] of Object.entries(db.sessions)) if (s.exp < Date.now()) delete db.sessions[h];
  save();
};
purge();
setInterval(purge, 3600 * 1000).unref();
const findByEmail = (email) => Object.values(db.users).find((u) => u.email === email);

const auth = (req, res, next) => {
  const m = /^Bearer ([\w-]{20,100})$/.exec(req.headers.authorization || "");
  const hash = m && sha(m[1]);
  const s = hash && db.sessions[hash];
  const user = s && s.exp > Date.now() && db.users[s.userId];
  if (!user) return res.status(401).json({ error: "Sessie verlopen, log opnieuw in" });
  req.user = user;
  req.sessionHash = hash;
  if (user.setupRequired && !/^\/api\/(totp|me|auth\/logout)/.test(req.originalUrl))
    return res.status(403).json({ error: "Beveilig eerst je account met een authenticator-app", setupRequired: true });
  next();
};

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        mediaSrc: ["'self'", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.dailymotion.com", "https://geo.dailymotion.com", "https://archive.org"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: false, // the app is served over plain http on the phone; put it behind https to enable HSTS
  }),
);
const allowed = new Set(["http://localhost", "https://localhost", "capacitor://localhost", ...(process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean)]);
app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.has(o)) }));
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api"))
      console.log(`${new Date().toLocaleTimeString("nl-NL")}  ${req.method.padEnd(6)} ${req.path}  ${res.statusCode}  ${Date.now() - start}ms`);
  });
  next();
});
app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const tooMany = (msg) => ({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: msg } });
const authLimit = rateLimit(tooMany("Te veel pogingen, probeer het over 15 minuten opnieuw"));
app.use("/api/auth", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api/library", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

app.post("/api/auth/register", authLimit, async (req, res) => {
  const name = cleanName(req.body?.name);
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!name) return res.status(400).json({ error: "Vul een naam in" });
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Dit e-mailadres lijkt niet te kloppen" });
  const problem = passwordProblem(req.body?.password);
  if (problem) return res.status(400).json({ error: problem });
  if (findByEmail(email)) return res.status(409).json({ error: "Er bestaat al een account met dit e-mailadres" });
  const user = { id: String(db.nextId++), name, email, passwordHash: await hashPassword(req.body.password), created: Date.now(), fails: 0, lockUntil: 0, setupRequired: true };
  db.users[user.id] = user;
  db.library[user.id] = {};
  res.status(201).json({ token: newSession(user.id), user: publicUser(user) });
});

app.post("/api/auth/login", authLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 128) : "";
  const user = findByEmail(email);
  if (user && user.lockUntil > Date.now()) return res.status(429).json({ error: "Account tijdelijk geblokkeerd na te veel pogingen. Probeer het later opnieuw." });
  const ok = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    if (user && ++user.fails >= 5) { user.fails = 0; user.lockUntil = Date.now() + 15 * 60_000; }
    save();
    return res.status(401).json({ error: "E-mailadres of wachtwoord klopt niet" });
  }
  if (user.totp?.enabled) {
    if (!req.body?.code) return res.status(401).json({ error: "Voer je authenticator-code in", needTotp: true });
    if (!checkSecondFactor(user, req.body.code)) {
      if (++user.fails >= 5) { user.fails = 0; user.lockUntil = Date.now() + 15 * 60_000; }
      save();
      return res.status(401).json({ error: "Authenticator-code klopt niet", needTotp: true });
    }
  }
  user.fails = 0;
  res.json({ token: newSession(user.id), user: publicUser(user) });
});

// Forgot password: a one-time code is generated on the device itself (`node reset-code.js <email>`) or, if enabled, by an authenticator/backup code,
// so no email server is needed. Only a hash of the code is stored, it expires and allows 5 tries.
const resetsFile = path.join(dataDir, "resets.json");
const readResets = () => { try { return JSON.parse(fs.readFileSync(resetsFile, "utf8")); } catch { return {}; } };
const writeResets = (r) => fs.writeFileSync(resetsFile, JSON.stringify(r), { mode: 0o600 });
const lastMail = new Map();
// Emails a one-time reset code. Always answers the same, so it can't be used to find out which emails have accounts.
app.post("/api/auth/forgot", authLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const user = findByEmail(email);
  const wait = Date.now() - (lastMail.get(email) || 0) < 60_000;
  if (user && !wait) {
    lastMail.set(email, Date.now());
    const code = Array.from(crypto.randomBytes(8), (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 31]).join("");
    const resets = readResets();
    resets[email] = { hash: sha(code), exp: Date.now() + 15 * 60_000, tries: 0 };
    writeResets(resets);
    sendMail(email, "Je Difonti-resetcode", `Hoi ${user.name},\n\nJe resetcode is: ${code}\n\nDeze code is 15 minuten geldig. Heb je dit niet aangevraagd? Dan kun je deze mail negeren.`).catch((e) => console.log("mail failed:", e.message));
  }
  res.json({ ok: true, mail: mailEnabled });
});

app.post("/api/auth/reset", authLimit, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase().slice(0, 20) : "";
  const bad = () => res.status(400).json({ error: "Code onjuist of verlopen" });
  const user = findByEmail(email);
  if (!user) { await verifyPassword("x", DUMMY_HASH); return bad(); }
  if (user.lockUntil > Date.now()) return res.status(429).json({ error: "Account tijdelijk geblokkeerd. Probeer het later opnieuw." });
  const problem = passwordProblem(req.body?.password);
  if (problem) return res.status(400).json({ error: problem });
  const resets = readResets();
  const r = resets[email];
  let ok = false;
  if (user.totp?.enabled && checkSecondFactor(user, code)) ok = true; // authenticator or backup code
  else if (r && r.exp > Date.now() && crypto.timingSafeEqual(Buffer.from(sha(code)), Buffer.from(r.hash))) {
    ok = true; // one-time code made on the device with reset-code.js
    delete resets[email];
    fs.writeFileSync(resetsFile, JSON.stringify(resets), { mode: 0o600 });
  }
  if (!ok) {
    if (r && ++r.tries >= 5) { delete resets[email]; fs.writeFileSync(resetsFile, JSON.stringify(resets), { mode: 0o600 }); }
    if (++user.fails >= 5) { user.fails = 0; user.lockUntil = Date.now() + 15 * 60_000; }
    save();
    return bad();
  }
  user.passwordHash = await hashPassword(req.body.password);
  user.fails = 0;
  user.lockUntil = 0;
  revokeAll(user.id);
  res.json({ token: newSession(user.id), user: publicUser(user) });
});

// ---- authenticator app (TOTP) ----
app.post("/api/totp/setup", auth, async (req, res) => {
  if (req.user.totp?.enabled) return res.status(400).json({ error: "Authenticator staat al aan" });
  const secret = newSecret();
  req.user.totp = { enabled: false, secret: seal(secret), backup: [], last: 0 };
  save();
  const uri = otpauth(req.user.email, secret);
  res.json({ secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) });
});

app.post("/api/totp/enable", authLimit, auth, (req, res) => {
  const t = req.user.totp;
  if (!t || t.enabled) return res.status(400).json({ error: "Start eerst de installatie" });
  const step = matchStep(unseal(t.secret), String(req.body?.code ?? "").replace(/\s/g, ""), 0);
  if (!step) return res.status(400).json({ error: "Code klopt niet. Controleer de tijd op je telefoon en probeer opnieuw." });
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase());
  t.enabled = true;
  t.last = step;
  t.backup = codes.map(sha8);
  delete req.user.setupRequired;
  save();
  res.json({ backupCodes: codes, user: publicUser(req.user) });
});

app.post("/api/totp/disable", authLimit, auth, async (req, res) => {
  const pw = typeof req.body?.password === "string" ? req.body.password.slice(0, 128) : "";
  if (!(await verifyPassword(pw, req.user.passwordHash))) return res.status(401).json({ error: "Wachtwoord klopt niet" });
  if (req.user.totp?.enabled && !checkSecondFactor(req.user, req.body?.code)) return res.status(401).json({ error: "Authenticator-code klopt niet" });
  delete req.user.totp;
  save();
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", auth, (req, res) => {
  delete db.sessions[req.sessionHash];
  save();
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => res.json(publicUser(req.user)));

app.patch("/api/me", auth, (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Vul een naam in" });
  req.user.name = name;
  save();
  res.json(publicUser(req.user));
});

app.post("/api/auth/password", authLimit, auth, async (req, res) => {
  const { current, next } = req.body ?? {};
  if (typeof current !== "string" || !(await verifyPassword(current.slice(0, 128), req.user.passwordHash)))
    return res.status(401).json({ error: "Huidig wachtwoord klopt niet" });
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  req.user.passwordHash = await hashPassword(next);
  revokeAll(req.user.id, req.sessionHash);
  res.json({ ok: true });
});

app.delete("/api/me", authLimit, auth, async (req, res) => {
  const pw = typeof req.body?.password === "string" ? req.body.password.slice(0, 128) : "";
  if (!(await verifyPassword(pw, req.user.passwordHash))) return res.status(401).json({ error: "Wachtwoord klopt niet" });
  revokeAll(req.user.id);
  delete db.library[req.user.id];
  delete db.users[req.user.id];
  save();
  res.json({ ok: true });
});

app.get("/api/services", (_req, res) => res.json(services));

app.get("/api/titles", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  res.json(titles.filter((t) => !q || t.title.toLowerCase().includes(q)).slice(0, 300));
});

// ---- personal library (MyAnimeList-style: status, score, note) ----
const view = (e) => ({ id: e.item.id, status: e.status, score: e.score, note: e.note, updated: e.updated, item: e.item });
app.get("/api/library", auth, (req, res) => res.json(Object.values(db.library[req.user.id] ?? {}).map(view)));

app.put("/api/library/:titleId", auth, (req, res) => {
  const lib = (db.library[req.user.id] ??= {});
  const existing = lib[req.params.titleId];
  const item = titles.find((t) => t.id === req.params.titleId) ?? existing?.item;
  if (!item) return res.status(404).json({ error: "Onbekende titel" });
  const { status = existing?.status ?? "planned", score = existing?.score ?? 0, note = existing?.note ?? "" } = req.body ?? {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Ongeldige status" });
  if (!Number.isInteger(score) || score < 0 || score > 10) return res.status(400).json({ error: "Cijfer moet tussen 0 en 10 liggen" });
  if (typeof note !== "string") return res.status(400).json({ error: "Ongeldige notitie" });
  if (Object.keys(lib).length >= 2000 && !existing) return res.status(400).json({ error: "Je lijst is vol" });
  lib[item.id] = { status, score, note: note.slice(0, 500), updated: Date.now(), item };
  save();
  res.json(view(lib[item.id]));
});

app.delete("/api/library/:titleId", auth, (req, res) => {
  delete db.library[req.user.id]?.[req.params.titleId];
  save();
  res.json({ ok: true });
});

// Resolves a browser-playable mp4 for an Internet Archive item (used by the HTML5 <video> player)
app.get("/api/archive/:id/video", async (req, res) => {
  try {
    const url = await archiveVideoUrl(req.params.id);
    url ? res.json({ url }) : res.status(404).json({ error: "No playable file" });
  } catch {
    res.status(502).json({ error: "Archive unavailable" });
  }
});

// Serve the built frontend (frontend/dist) so one process runs the whole app, e.g. in Termux
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`API listening on http://localhost:${PORT}`));
