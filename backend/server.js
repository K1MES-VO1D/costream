import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { services, titles, refreshCatalog, loadCache, archiveVideoUrl } from "./catalog.js";

const PORT = process.env.PORT || 4000;
// Use JWT_SECRET if set; otherwise generate a random secret once and keep it in a git-ignored file.
const secretFile = path.join(path.dirname(fileURLToPath(import.meta.url)), ".jwt-secret");
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (fs.existsSync(secretFile)
    ? fs.readFileSync(secretFile, "utf8").trim()
    : (() => {
        const s = crypto.randomBytes(48).toString("hex");
        fs.writeFileSync(secretFile, s, { mode: 0o600 });
        return s;
      })());

const users = new Map(); // email -> { id, name, email, passwordHash }
const watchlists = new Map(); // userId -> Set(titleId)
loadCache();
refreshCatalog().catch((e) => console.log("catalog refresh failed:", e.message));
setInterval(() => refreshCatalog().catch(() => {}), 6 * 60 * 60 * 1000).unref();
let nextUserId = 1;

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api"))
      console.log(`${new Date().toLocaleTimeString("nl-NL")}  ${req.method.padEnd(6)} ${req.originalUrl}  ${res.statusCode}  ${Date.now() - start}ms`);
  });
  next();
});

const auth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

const tokenFor = (u) => jwt.sign({ id: u.id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: "7d" });

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: "Name, email and a password of 6+ characters are required" });
  const key = email.toLowerCase();
  if (users.has(key)) return res.status(409).json({ error: "Email already registered" });
  const user = { id: nextUserId++, name, email: key, passwordHash: await bcrypt.hash(password, 10) };
  users.set(key, user);
  res.status(201).json({ token: tokenFor(user), user: { id: user.id, name, email: key } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = users.get((email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash)))
    return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/services", (_req, res) => res.json(services));

app.get("/api/titles", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  res.json(titles.filter((t) => !q || t.title.toLowerCase().includes(q)).slice(0, 300));
});

app.get("/api/watchlist", auth, (req, res) => res.json([...(watchlists.get(req.user.id) ?? [])]));

app.post("/api/watchlist/:titleId", auth, (req, res) => {
  if (!titles.some((t) => t.id === req.params.titleId)) return res.status(404).json({ error: "Unknown title" });
  const list = watchlists.get(req.user.id) ?? new Set();
  list.add(req.params.titleId);
  watchlists.set(req.user.id, list);
  res.status(201).json([...list]);
});

app.delete("/api/watchlist/:titleId", auth, (req, res) => {
  const list = watchlists.get(req.user.id) ?? new Set();
  list.delete(req.params.titleId);
  res.json([...list]);
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
