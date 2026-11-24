// Catalog of legally free sources. Titles are refreshed live from public APIs (no scraping of paid services).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cacheFile = path.join(path.dirname(fileURLToPath(import.meta.url)), ".catalog-cache.json");

export const services = [
  { id: "archive", name: "Internet Archive", category: "Publiek domein", color: "#c9a227", description: "Klassieke films en series uit het publiek domein.", free: true },
  { id: "dailymotion", name: "Dailymotion", category: "Gratis video", color: "#3a7bd5", description: "Vrij te bekijken films en series.", free: true },
  { id: "vimeo", name: "Vimeo", category: "Gratis video", color: "#1ab7ea", description: "Open films en creator-series op Vimeo.", free: true },
  { id: "youtube", name: "YouTube", category: "Gratis video", color: "#d9674b", description: "Gratis volledige films en series op YouTube.", free: true },
];

const palettes = [
  ["#2f5d73", "#8fb8c9"], ["#6b3f5e", "#c79bb5"], ["#3d5a3d", "#a3c4a0"], ["#8c3b2a", "#e0a58f"],
  ["#43396b", "#a79bd6"], ["#5a4a2a", "#d6c28a"], ["#2a4d57", "#7fc1b6"],
];
const colorsFor = (id) => palettes[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length];
const clean = (v, n = 220) => {
  const text = (Array.isArray(v) ? v[0] : v) ?? "";
  return String(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
};
const get = async (url, headers) => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

// Seed titles that work even before the first refresh succeeds
const seed = [
  { id: "f1", title: "Big Buck Bunny", type: "film", year: 2008, serviceId: "youtube", why: "Een enorm konijn neemt wraak op drie plaaggeesten. Open film van Blender.", runtime: "10 min", videoUrl: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", youtubeId: "aqz-KE-bpKQ" },
  { id: "f2", title: "Sintel", type: "film", year: 2010, serviceId: "youtube", why: "Een jonge vrouw zoekt haar draakje. Prachtig geanimeerd fantasy-avontuur.", runtime: "15 min", videoUrl: "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4", youtubeId: "eRsGyueVLvQ" },
  { id: "f3", title: "Tears of Steel", type: "film", year: 2012, serviceId: "youtube", why: "Sciencefiction in Amsterdam: een groep strijdt tegen robots.", runtime: "12 min", youtubeId: "R6MlUcmOul8" },
  { id: "f4", title: "Elephants Dream", type: "film", year: 2006, serviceId: "youtube", why: "Eerste open film ooit: een surrealistische machinewereld.", runtime: "11 min", videoUrl: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4", youtubeId: "TLkA0RELQ1g" },
  { id: "a-night_of_the_living_dead", title: "Night of the Living Dead", type: "film", year: 1968, serviceId: "archive", why: "Horrorklassieker (publiek domein) van George A. Romero.", archiveId: "night_of_the_living_dead", poster: "https://archive.org/services/img/night_of_the_living_dead" },
].map((t) => ({ colors: colorsFor(t.id), free: true, ...t }));

export const titles = [...seed];

const setTitles = (list) => {
  const seen = new Set();
  const merged = [...seed, ...list].filter((t) => !seen.has(t.id) && seen.add(t.id));
  titles.splice(0, titles.length, ...merged);
};

async function fromArchive(query, type, rows) {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&sort[]=downloads+desc&rows=${rows}&output=json`;
  const { response } = await get(url);
  return response.docs.map((d) => ({
    id: `a-${d.identifier}`, title: clean(d.title, 90), type, year: Number(d.year) || undefined, serviceId: "archive",
    why: clean(d.description) || "Publiek domein via het Internet Archive.", archiveId: d.identifier,
    poster: `https://archive.org/services/img/${d.identifier}`, colors: colorsFor(d.identifier), free: true,
  }));
}

async function fromDailymotion(search, type, limit) {
  const url = `https://api.dailymotion.com/videos?search=${encodeURIComponent(search)}&fields=id,title,description,thumbnail_480_url,duration,created_time&limit=${limit}&sort=relevance&longer_than=${type === "film" ? 40 : 15}&flags=no_live`;
  const { list } = await get(url);
  return list.map((v) => ({
    id: `d-${v.id}`, title: clean(v.title, 90), type, year: new Date(v.created_time * 1000).getFullYear(), serviceId: "dailymotion",
    why: clean(v.description) || "Gratis op Dailymotion.", runtime: `${Math.round(v.duration / 60)} min`,
    embedUrl: `https://www.dailymotion.com/embed/video/${v.id}`, poster: v.thumbnail_480_url, colors: colorsFor(v.id), free: true,
  }));
}

// Optional sources that need a free API key: set VIMEO_TOKEN / YOUTUBE_API_KEY to enable
async function fromVimeo(query, type) {
  const url = `https://api.vimeo.com/videos?query=${encodeURIComponent(query)}&filter=CC&per_page=25&fields=uri,name,description,duration,created_time,pictures.base_link,embed.html`;
  const { data } = await get(url, { Authorization: `bearer ${process.env.VIMEO_TOKEN}` });
  return data.map((v) => {
    const id = v.uri.split("/").pop();
    return {
      id: `v-${id}`, title: clean(v.name, 90), type, year: new Date(v.created_time).getFullYear(), serviceId: "vimeo",
      why: clean(v.description) || "Open licentie op Vimeo.", runtime: `${Math.round(v.duration / 60)} min`,
      embedUrl: `https://player.vimeo.com/video/${id}`, poster: v.pictures?.base_link, colors: colorsFor(id), free: true,
    };
  });
}

async function fromYoutube(query, type) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoLicense=creativeCommon&videoEmbeddable=true&videoDuration=${type === "film" ? "long" : "medium"}&maxResults=25&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`;
  const { items } = await get(url);
  return items.map((v) => ({
    id: `y-${v.id.videoId}`, title: clean(v.snippet.title, 90), type, year: new Date(v.snippet.publishedAt).getFullYear(), serviceId: "youtube",
    why: clean(v.snippet.description) || "Gratis op YouTube.", youtubeId: v.id.videoId,
    poster: v.snippet.thumbnails?.high?.url, colors: colorsFor(v.id.videoId), free: true,
  }));
}

export async function refreshCatalog() {
  const jobs = [
    fromArchive("collection:feature_films AND mediatype:movies", "film", 60),
    fromArchive("collection:classic_tv AND mediatype:movies", "series", 40),
    fromDailymotion("public domain full movie", "film", 25),
    fromDailymotion("classic tv series full episode", "series", 20),
  ];
  if (process.env.VIMEO_TOKEN) jobs.push(fromVimeo("public domain film", "film"), fromVimeo("web series", "series"));
  if (process.env.YOUTUBE_API_KEY) jobs.push(fromYoutube("full movie public domain", "film"), fromYoutube("classic tv series full episode", "series"));
  const results = await Promise.allSettled(jobs);
  const ok = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value).filter((t) => t.title);
  results.filter((r) => r.status === "rejected").forEach((r) => console.log("catalog source skipped:", r.reason.message));
  if (ok.length) {
    setTitles(ok);
    fs.writeFileSync(cacheFile, JSON.stringify(ok));
  }
  console.log(`catalog: ${titles.length} titles`);
}

export function loadCache() {
  try { setTitles(JSON.parse(fs.readFileSync(cacheFile, "utf8"))); } catch { /* no cache yet */ }
}

// Finds a browser-playable file for an Internet Archive item so the app can use an HTML5 <video> tag
const videoCache = new Map();
export async function archiveVideoUrl(id) {
  if (!/^[\w.-]+$/.test(id)) return null;
  if (videoCache.has(id)) return videoCache.get(id);
  const { files = [] } = await get(`https://archive.org/metadata/${id}`);
  const mp4s = files.filter((f) => /\.mp4$/i.test(f.name) && !/_sample|trailer/i.test(f.name));
  const pick = mp4s.find((f) => /h\.?264|mpeg4/i.test(f.format)) || mp4s[0];
  const url = pick ? `https://archive.org/download/${id}/${encodeURIComponent(pick.name)}` : null;
  videoCache.set(id, url);
  return url;
}
