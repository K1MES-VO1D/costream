// Termux: node add-playlist.js <youtube-playlist-url> [--type film|series]
// Imports every video of a public playlist. Video titles must look like "Movie title 1999" (or "Movie title (1999)");
// everything after the year is dropped and no description is stored. No API key: the public playlist page is read.
import fs from "node:fs";
import path from "node:path";
import { dir } from "./store.js";

const args = process.argv.slice(2);
const typeIdx = args.indexOf("--type");
const type = typeIdx >= 0 ? args.splice(typeIdx, 2)[1] : "film";
const list = args[0]?.match(/[?&]list=([\w-]+)/)?.[1] || (/^[\w-]{13,}$/.test(args[0] || "") ? args[0] : "");
if (!list || !["film", "series"].includes(type)) {
  console.error('Gebruik: node add-playlist.js "https://www.youtube.com/playlist?list=..." [--type film|series]');
  process.exit(1);
}

export function parseTitle(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  const paren = text.match(/^(.+?)\s*[(\[]((?:19|20)\d\d)[)\]]/);
  if (paren) return { title: paren[1].replace(/[\s\-–—|:,]+$/, ""), year: Number(paren[2]) };
  for (const m of text.matchAll(/\b(?:19|20)\d\d\b/g)) {
    const title = text.slice(0, m.index).replace(/[\s\-–—|:,]+$/, "");
    if (title) return { title, year: Number(m[0]) };
  }
  return null;
}

const walk = (node, out) => {
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else if (node && typeof node === "object") {
    if (node.playlistVideoRenderer) {
      const v = node.playlistVideoRenderer;
      out.push({ id: v.videoId, name: v.title?.runs?.map((r) => r.text).join("") || v.title?.simpleText || "" });
    }
    Object.values(node).forEach((n) => walk(n, out));
  }
};

async function fetchVideos() {
  const res = await fetch(`https://www.youtube.com/playlist?list=${list}&hl=en`, { headers: { "accept-language": "en", cookie: "CONSENT=YES+1" }, signal: AbortSignal.timeout(15000) });
  const html = await res.text();
  const json = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  const out = [];
  if (json) walk(JSON.parse(json), out);
  if (out.length) return out;
  // Fallback: the public RSS feed (latest 15 videos)
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${list}`, { signal: AbortSignal.timeout(15000) })).text();
  return [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => ({ id: m[1], name: m[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"') }));
}

if (process.argv[1].endsWith("add-playlist.js")) {
  const videos = await fetchVideos();
  if (!videos.length) { console.error("Geen video's gevonden. Is de afspeellijst openbaar of niet-gepubliceerd?"); process.exit(1); }
  const target = path.join(dir, "extra-titles.json");
  let items = [];
  try { items = JSON.parse(fs.readFileSync(target, "utf8")); } catch { /* new file */ }
  let added = 0;
  for (const v of videos) {
    const p = parseTitle(v.name);
    if (!p) { console.log(`Overgeslagen (geen jaar): ${v.name}`); continue; }
    const id = `yt-${v.id}`;
    items = items.filter((t) => t.id !== id).concat({ id, title: p.title, year: p.year, type, why: "", serviceId: "youtube", youtubeId: v.id, poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, free: true });
    added++;
  }
  fs.writeFileSync(target, JSON.stringify(items, null, 2));
  console.log(`${added} van ${videos.length} titels toegevoegd.`);
}
