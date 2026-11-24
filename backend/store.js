import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Tiny JSON-file database: atomic writes, owner-only permissions, survives restarts.
const dir = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, "db.json");

export const db = { nextId: 1, users: {}, sessions: {}, library: {} };
if (fs.existsSync(file)) {
  try { Object.assign(db, JSON.parse(fs.readFileSync(file, "utf8"))); }
  catch (e) { throw new Error(`db.json is corrupt (${e.message}); fix or move it away`); }
}

let timer = null;
export const flush = () => {
  clearTimeout(timer);
  timer = null;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, file);
};
export const save = () => { timer ??= setTimeout(flush, 150); };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { flush(); process.exit(0); });
process.on("exit", () => { if (timer) flush(); });
