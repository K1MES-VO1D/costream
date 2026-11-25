// Termux: node add-title.js <url> [--title "..."] [--year 1999] [--type film|series] [--why "..."] [--runtime "95 min"] [--poster <url>]
// Without flags it asks for everything. Saved in data/extra-titles.json and shown in the catalog right away.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { dir } from "./store.js";

const args = process.argv.slice(2);
const flags = {};
let url = "";
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
  else url = args[i];
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def = "") => flags[q.key] ?? ((await rl.question(`${q.text}${def ? ` [${def}]` : ""}: `)).trim() || def);

url ||= (await rl.question("Link (YouTube, Vimeo, Dailymotion of videobestand): ")).trim();
const yt = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1];
const vm = url.match(/vimeo\.com\/(?:video\/|.*\/)?(\d{6,})/)?.[1];
const dm = url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-z0-9]+)/i)?.[1];
const file = /\.(mp4|webm|ogv|m4v|mov)(\?|#|$)/i.test(url);
if (!yt && !vm && !dm && !file) { console.error("Link niet herkend. Gebruik YouTube, Vimeo, Dailymotion of een directe .mp4/.webm-link."); process.exit(1); }

const title = await ask({ key: "title", text: "Titel" }, "");
const type = await ask({ key: "type", text: "Type (film/series)" }, "film");
const year = Number(await ask({ key: "year", text: "Jaar" }));
const why = await ask({ key: "why", text: "Beschrijving" }, "");
const runtime = await ask({ key: "runtime", text: "Speelduur (bijv. 95 min)" }, "");
const poster = await ask({ key: "poster", text: "Poster-URL (optioneel)" }, "");
rl.close();

if (!title) { console.error("Titel is verplicht."); process.exit(1); }
if (!["film", "series"].includes(type)) { console.error("Type moet film of series zijn."); process.exit(1); }
if (!(year >= 1888 && year <= new Date().getFullYear() + 1)) { console.error("Vul een geldig jaar in."); process.exit(1); }

const id = yt ? `yt-${yt}` : vm ? `vimeo-${vm}` : dm ? `dm-${dm}` : `x-${Buffer.from(url).toString("base64url").slice(0, 12)}`;
const item = {
  id, title, type, year, why, free: true, custom: false,
  serviceId: yt ? "youtube" : vm ? "vimeo" : dm ? "dailymotion" : "youtube",
  ...(runtime && { runtime }), ...(poster && { poster }),
  ...(yt && { youtubeId: yt }),
  ...(vm && { embedUrl: `https://player.vimeo.com/video/${vm}` }),
  ...(dm && { embedUrl: `https://www.dailymotion.com/embed/video/${dm}` }),
  ...(file && { videoUrl: url }),
};
const target = path.join(dir, "extra-titles.json");
let list = [];
try { list = JSON.parse(fs.readFileSync(target, "utf8")); } catch { /* new file */ }
list = list.filter((t) => t.id !== id).concat(item);
fs.writeFileSync(target, JSON.stringify(list, null, 2));
console.log(`Toegevoegd: ${title} (${year}). Totaal eigen titels: ${list.length}`);
