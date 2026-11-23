import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

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

// Catalog of streaming services, each with tiered plans (illustrative monthly prices in EUR)
const plan = (id, name, price, quality, screens) => ({ id, name, price, quality, screens });
const services = [
  { id: "gratis", name: "Gratis", free: true, category: "Gratis kijken", color: "#2e9e5b",
    description: "Open-licentie en publiek-domein films die je direct in de app kunt kijken.", plans: [] },
  { id: "netflix", name: "Netflix", category: "Series & films", color: "#e50914",
    description: "Originals, films en series voor elk gezelschap.",
    plans: [plan("basic", "Basis met reclame", 5.99, "1080p", 2), plan("standard", "Standaard", 13.99, "1080p", 2), plan("premium", "Premium", 19.99, "4K", 4)] },
  { id: "hulu", name: "Hulu", category: "Series & films", color: "#1ce783",
    description: "Populaire tv-series, originals en films.",
    plans: [plan("ads", "Met reclame", 9.99, "1080p", 2), plan("noads", "Zonder reclame", 18.99, "1080p", 2)] },
  { id: "skyshowtime", name: "SkyShowtime", category: "Series & films", color: "#7b5cff",
    description: "Series en films van Paramount+, Peacock en Universal.",
    plans: [plan("standard", "Standaard", 6.99, "1080p", 2), plan("premium", "Premium", 9.99, "4K", 4)] },
  { id: "hbomax", name: "HBO Max", category: "Series & films", color: "#5a2ee6",
    description: "HBO-series, Warner Bros. films en Max Originals.",
    plans: [plan("basic", "Basic met reclame", 5.99, "1080p", 2), plan("standard", "Standard", 9.99, "1080p", 2), plan("premium", "Premium", 13.99, "4K", 4)] },
  { id: "disney", name: "Disney+", category: "Familie", color: "#113ccf",
    description: "Disney, Pixar, Marvel, Star Wars en National Geographic.",
    plans: [plan("standard", "Standaard", 9.99, "1080p", 2), plan("premium", "Premium", 13.99, "4K", 4)] },
  { id: "prime", name: "Prime Video", category: "Series & films", color: "#00a8e1",
    description: "Films, series en Amazon Originals.",
    plans: [plan("prime", "Prime Video", 5.99, "4K", 3)] },
  { id: "videoland", name: "Videoland", category: "Nederlands", color: "#e5004f",
    description: "Nederlandse series en RTL-programma's.",
    plans: [plan("basic", "Basis", 5.99, "1080p", 1), plan("standard", "Standaard", 9.99, "1080p", 2), plan("premium", "Premium", 12.99, "4K", 4)] },
];

// Where each service's own player/search lives; {q} is replaced with the title
const watchUrls = {
  netflix: "https://www.netflix.com/search?q={q}",
  hulu: "https://www.hulu.com/search?q={q}",
  skyshowtime: "https://www.skyshowtime.com/",
  hbomax: "https://www.hbomax.com/",
  disney: "https://www.disneyplus.com/search/{q}",
  prime: "https://www.primevideo.com/search/ref=atv_nb_sug?phrase={q}",
  videoland: "https://www.videoland.com/",
};
services.forEach((s) => { s.watchUrl = watchUrls[s.id]; });

// Bundle discount by number of active services
const discountFor = (n) => (n >= 4 ? 0.2 : n === 3 ? 0.15 : n === 2 ? 0.1 : 0);

const users = new Map(); // email -> { id, name, email, passwordHash }
const subscriptions = new Map(); // userId -> Map(serviceId -> { planId, startedAt })
const watchlists = new Map(); // userId -> Set(titleId)

// Fictional titles; posters are rendered as gradients on the client
const titles = [
  ["t1", "Midnight Harbor", "series", 2025, "netflix", "Stemmige thriller met een onverwachte plot-twist elke aflevering.", ["#0f2027", "#2c5364"]],
  ["t2", "The Last Orchard", "film", 2024, "hulu", "Warm familiedrama dat je zeker even doet janken.", ["#614385", "#516395"]],
  ["t3", "Zero Gravity", "film", 2025, "skyshowtime", "Spectaculaire sciencefiction, het best op groot scherm.", ["#000428", "#004e92"]],
  ["t4", "Kleine Helden", "series", 2025, "disney", "Leuk en leerzaam voor de kleintjes, zonder irritante liedjes.", ["#f7971e", "#ffd200"]],
  ["t5", "Derby Night", "film", 2024, "prime", "Het mooiste voetbaldrama van het jaar.", ["#1d976c", "#93f9b9"]],
  ["t6", "Deep Blue Planet", "series", 2025, "hbomax", "Adembenemende beelden van de diepzee.", ["#136a8a", "#267871"]],
  ["t7", "Cold Case Amsterdam", "series", 2025, "videoland", "Binge-waardig: acht afleveringen die je niet loslaat.", ["#cb2d3e", "#ef473a"]],
  ["t8", "Rhythm of the City", "series", 2024, "netflix", "Muziekserie over de straten van Rotterdam.", ["#4776e6", "#8e54e9"]],
  ["t9", "The Quiet Summit", "film", 2023, "hbomax", "Indrukwekkende klimdocu over de Himalaya.", ["#757f9a", "#d7dde8"]],
  ["t10", "Stadium Roar", "series", 2025, "skyshowtime", "Achter de schermen bij een Europees topteam.", ["#f12711", "#f5af19"]],
].map(([id, title, type, year, serviceId, why, colors]) => ({ id, title, type, year, serviceId, why, colors }));

// Free, legally playable titles (open-licensed Blender films and a public-domain classic)
const GTV = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";
const freeTitles = [
  ["f1", "Big Buck Bunny", "film", 2008, "Een enorm konijn neemt wraak op drie plaaggeesten. Open film van Blender.", ["#2e7d32", "#a5d6a7"], { videoUrl: `${GTV}/BigBuckBunny.mp4`, runtime: "10 min" }],
  ["f2", "Sintel", "film", 2010, "Een jonge vrouw zoekt haar draakje. Prachtig geanimeerd fantasy-avontuur.", ["#6a1b9a", "#ce93d8"], { videoUrl: `${GTV}/Sintel.mp4`, runtime: "15 min" }],
  ["f3", "Tears of Steel", "film", 2012, "Sciencefiction in Amsterdam: een groep strijdt tegen robots. Gemaakt door Blender.", ["#01579b", "#4fc3f7"], { videoUrl: `${GTV}/TearsOfSteel.mp4`, runtime: "12 min" }],
  ["f4", "Elephants Dream", "film", 2006, "Eerste open film ooit: twee vreemde bewoners in een surrealistische machinewereld.", ["#bf360c", "#ffab91"], { videoUrl: `${GTV}/ElephantsDream.mp4`, runtime: "11 min" }],
  ["f5", "Night of the Living Dead", "film", 1968, "Horrorklassieker (publiek domein) van George A. Romero, via het Internet Archive.", ["#212121", "#757575"], { embedUrl: "https://archive.org/embed/night_of_the_living_dead", runtime: "96 min" }],
].map(([id, title, type, year, why, colors, extra]) => ({ id, title, type, year, serviceId: "gratis", why, colors, free: true, ...extra }));
titles.push(...freeTitles);
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

const findPlan = (serviceId, planId) => {
  const service = services.find((s) => s.id === serviceId);
  return { service, plan: service?.plans.find((p) => p.id === planId) };
};

const summary = (userId) => {
  const subs = subscriptions.get(userId) ?? new Map();
  const items = [...subs].map(([serviceId, { planId, startedAt }]) => {
    const { service, plan } = findPlan(serviceId, planId);
    return { serviceId, serviceName: service.name, color: service.color, plan, startedAt };
  });
  const subtotal = items.reduce((sum, i) => sum + i.plan.price, 0);
  const discountRate = discountFor(items.length);
  const discount = +(subtotal * discountRate).toFixed(2);
  return { items, subtotal: +subtotal.toFixed(2), discountRate, discount, total: +(subtotal - discount).toFixed(2) };
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
  res.json(titles.filter((t) => !q || t.title.toLowerCase().includes(q)));
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

app.get("/api/subscriptions", auth, (req, res) => res.json(summary(req.user.id)));

// Subscribe to a service, or change plan if already subscribed
app.post("/api/subscriptions", auth, (req, res) => {
  const { serviceId, planId } = req.body ?? {};
  const { plan } = findPlan(serviceId, planId);
  if (!plan) return res.status(400).json({ error: "Unknown service or plan" });
  const subs = subscriptions.get(req.user.id) ?? new Map();
  subs.set(serviceId, { planId, startedAt: subs.get(serviceId)?.startedAt ?? new Date().toISOString() });
  subscriptions.set(req.user.id, subs);
  res.status(201).json(summary(req.user.id));
});

app.delete("/api/subscriptions/:serviceId", auth, (req, res) => {
  const subs = subscriptions.get(req.user.id);
  if (!subs?.delete(req.params.serviceId)) return res.status(404).json({ error: "Not subscribed" });
  res.json(summary(req.user.id));
});

// Serve the built frontend (frontend/dist) so one process runs the whole app, e.g. in Termux
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`API listening on http://localhost:${PORT}`));
