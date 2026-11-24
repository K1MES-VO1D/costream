import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./Icons.jsx";
import { STATUS_LABEL, EntryEditor } from "./Library.jsx";
import { normalizeLink, detectService, openLink, openInApp } from "./deeplinks.js";

const bg = (t) => ({ "--c1": t.colors[0], "--c2": t.colors[1] });
const label = (t) => `${t.type === "film" ? "Film" : "Serie"} · ${t.year}`;
const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
export const isPlayable = (t) => Boolean(t.videoUrl || t.embedUrl || t.youtubeId || t.archiveId);

function PlayButton({ title, onPlay }) {
  if (isPlayable(title)) return <button className="pill-btn play" onClick={stop(() => onPlay(title))}><Icon name="play" size={14} /> Kijk nu gratis</button>;
  if (title.deepLink) return <button className="pill-btn play" onClick={stop(() => openInApp(title.deepLink))}><Icon name="play" size={14} /> Open {title.linkName || "link"}</button>;
  return null;
}

function WatchButton({ saved, onToggle }) {
  return (
    <button className={`pill-btn ${saved ? "saved" : ""}`} onClick={stop(onToggle)}>
      <Icon name={saved ? "check" : "plus"} size={14} /> {saved ? (STATUS_LABEL[saved] || "Op mijn lijst") : "Mijn lijst"}
    </button>
  );
}

// Intro/promo cards shown before the personal tips
const promoCards = [
  { id: "welcome", tag: "Welkom", title: "Welkom bij Difonti: gratis films en series uit het publiek domein, op één plek.", art: "tv", cta: "Doe de tour", action: "tour", cls: "welcome" },
  { id: "sources", tag: "Bronnen", title: "Internet Archive, Dailymotion, Vimeo en YouTube, samen in één app.", art: "wallet", cta: "Zoek een titel", action: "search", cls: "promo-green" },
  { id: "tips", tag: "Zo werkt het", title: "Swipe door tips, bewaar wat je wilt kijken en speel het direct af.", art: "swipe", cta: "Naar mijn lijsten", action: "lists", cls: "promo-purple" },
];

// Swipeable "kijktips": the next card peeks in; works with touch and mouse drag
export function Tips({ titles: allTitles, services, watch, onToggle, onOpen, onPlay, onAction }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [index, setIndex] = useState(0);
  const titles = allTitles.slice(0, 40);
  const count = promoCards.length + titles.length;

  const onScroll = () => {
    const el = ref.current;
    const card = el.firstChild?.getBoundingClientRect().width + 16 || 1;
    setIndex(Math.round(el.scrollLeft / card));
  };
  const go = (i) => {
    const el = ref.current;
    const card = el.firstChild.getBoundingClientRect().width + 16;
    el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * card, behavior: "smooth" });
  };

  const down = (e) => { if (e.pointerType === "mouse") drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    ref.current.style.scrollSnapType = "none";
    ref.current.scrollLeft = d.left - dx;
  };
  const up = () => {
    if (!drag.current) return;
    ref.current.style.scrollSnapType = "";
    go(index);
    setTimeout(() => (drag.current = null), 0);
  };
  const open = (t) => { if (!drag.current?.moved) onOpen(t); };

  return (
    <>
      <div className="dots" aria-hidden="true">
        {Array.from({ length: Math.min(count, 12) }, (_, i) => <span key={i} className={i === index ? "on" : ""} />)}
      </div>
      <div className="swipe" ref={ref} onScroll={onScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
        {promoCards.map((c) => (
          <article key={c.id} className={`tip-card promo ${c.cls}`}>
            <div className="tip-content">
              <div className="welcome-art"><Icon name={c.art} size={72} /></div>
              <span className="tag">{c.tag}</span>
              <h2>{c.title}</h2>
              <button className="pill-btn" onClick={() => onAction(c.action)}>{c.cta}</button>
            </div>
          </article>
        ))}
        {titles.map((t) => (
          <article key={t.id} className="tip-card clickable" style={t.poster ? { ...bg(t), backgroundImage: `linear-gradient(transparent 30%, #061014), url(${t.poster})`, backgroundSize: "cover", backgroundPosition: "center" } : bg(t)} onClick={() => open(t)}>
            <div className="tip-content">
              <span className="tag">{services.find((s) => s.id === t.serviceId)?.name}</span>
              <small className="meta">{label(t)}</small>
              <h2>{t.title}</h2>
              <p>{t.why}</p>
              <div className="d-flex flex-wrap gap-2">
                <PlayButton title={t} onPlay={onPlay} />
                <WatchButton saved={watch[t.id]} onToggle={() => onToggle(t.id)} />
              </div>
            </div>
          </article>
        ))}
        {!titles.length && <p className="text-white-50 p-4">Geen tips voor deze filters. Pas je filters aan.</p>}
      </div>
      <div className="swipe-arrows">
        <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Vorige"><Icon name="back" size={20} /></button>
        <button onClick={() => go(index + 1)} disabled={index >= count - 1} aria-label="Volgende"><Icon name="next" size={20} /></button>
      </div>
    </>
  );
}

function PosterGrid({ titles, services, watch, onToggle, onOpen, onPlay }) {
  if (!titles.length) return <p className="text-white-50">Niets gevonden.</p>;
  return (
    <div className="row g-3">
      {titles.map((t) => (
        <div key={t.id} className="col-6">
          <div className="poster clickable" style={t.poster ? { ...bg(t), backgroundImage: `linear-gradient(transparent 40%, #05070f), url(${t.poster})`, backgroundSize: "cover" } : bg(t)} onClick={() => onOpen(t)}>
            <span className="tag">{services.find((s) => s.id === t.serviceId)?.name}</span>
            <div className="mt-auto w-100">
              <strong className="d-block">{t.title}</strong>
              <small className="opacity-75">{label(t)}</small>
              <PlayButton title={t} onPlay={onPlay} />
              {!t.custom && <WatchButton saved={watch[t.id]} onToggle={() => onToggle(t.id)} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const youtubeId = (url) => url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1];
const vimeoId = (url) => url.match(/vimeo\.com\/(?:video\/|.*\/)?(\d{6,})/)?.[1];
const dailymotionId = (url) => url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-z0-9]+)/i)?.[1];
const fileLink = /\.(mp4|webm|ogv|m4v|mov)(\?|#|$)/i;

// Paste a link: YouTube, Vimeo, Dailymotion and video files play in the app; other links open in the in-app web view
function LinkAdder({ onAdd }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("film");
  const [msg, setMsg] = useState("");
  const oembed = async (endpoint) => {
    try { return await (await fetch(endpoint)).json(); } catch { return {}; } // offline: fall back to the typed name
  };
  const add = async (e) => {
    e.preventDefault();
    const link = normalizeLink(url);
    if (!link) return setMsg("Geen geldige link.");
    const base = { type: kind, year: new Date().getFullYear(), custom: true, free: true, colors: ["#2f5d73", "#8fb8c9"] };
    const yt = youtubeId(link);
    const vm = vimeoId(link);
    const dm = dailymotionId(link);
    setMsg("Bezig…");
    let title = name.trim();
    let item;
    if (yt) {
      const info = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`);
      title = info.title || title;
      item = { ...base, id: `yt-${yt}`, serviceId: "youtube", why: `Gratis op YouTube${info.author_name ? ` van ${info.author_name}` : ""}.`, youtubeId: yt, poster: info.thumbnail_url };
    } else if (vm) {
      const info = await oembed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vm}`)}`);
      title = info.title || title;
      item = { ...base, id: `vimeo-${vm}`, serviceId: "vimeo", why: `Op Vimeo${info.author_name ? ` van ${info.author_name}` : ""}.`, embedUrl: `https://player.vimeo.com/video/${vm}`, poster: info.thumbnail_url };
    } else if (dm) {
      const info = await oembed(`https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(`https://www.dailymotion.com/video/${dm}`)}`);
      title = info.title || title;
      item = { ...base, id: `dm-${dm}`, serviceId: "dailymotion", why: `Op Dailymotion${info.author_name ? ` van ${info.author_name}` : ""}.`, embedUrl: `https://www.dailymotion.com/embed/video/${dm}`, poster: info.thumbnail_url };
    } else if (fileLink.test(link)) {
      item = { ...base, id: `video-${Date.now()}`, serviceId: "archive", why: "Direct afspeelbaar in de app.", videoUrl: link };
    } else {
      const { host } = detectService(link);
      item = { ...base, id: `link-${Date.now()}`, serviceId: "archive", why: `Opent ${host || "de link"} in de app.`, deepLink: link, linkName: host || "link" };
    }
    if (!title) return setMsg("Kon de titel niet ophalen; vul zelf een naam in.");
    onAdd({ ...item, title });
    setUrl("");
    setName("");
    setMsg("Toegevoegd!");
  };
  const needsName = url && !youtubeId(url) && !vimeoId(url) && !dailymotionId(url);
  return (
    <form onSubmit={add} className="mb-3">
      <div className="input-group mb-2">
        <input className="form-control" placeholder="Plak een link (YouTube, Vimeo, Dailymotion, mp4…)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 100 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="film">Film</option>
          <option value="series">Serie</option>
        </select>
        <button className="btn btn-danger" aria-label="Toevoegen"><Icon name="plus" size={18} /></button>
      </div>
      {needsName && <input className="form-control mb-1" placeholder="Naam van de titel" value={name} onChange={(e) => setName(e.target.value)} />}
      {msg && <small className="text-white-50">{msg}</small>}
    </form>
  );
}

export function Search({ custom, onAddCustom, ...props }) {
  const [q, setQ] = useState("");
  const [service, setService] = useState("");
  const [results, setResults] = useState([]);
  useEffect(() => {
    const id = setTimeout(() => api.titles(q).then(setResults).catch(() => {}), 200);
    return () => clearTimeout(id);
  }, [q]);
  const all = [...custom.filter((t) => t.title.toLowerCase().includes(q.toLowerCase())), ...results];
  const shown = all.filter((t) => !service || t.serviceId === service);
  return (
    <>
      <input className="form-control form-control-lg search-input mb-3" type="search" placeholder="Zoek een film of serie…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chip-row mb-3">
        {[{ id: "", name: "Alle bronnen" }, ...props.services].map((s) => (
          <button key={s.id} className={`btn btn-sm ${service === s.id ? "btn-light" : "btn-outline-light"}`} onClick={() => setService(s.id)}>{s.name}</button>
        ))}
      </div>
      <LinkAdder onAdd={onAddCustom} />
      <PosterGrid {...props} titles={shown} />
    </>
  );
}

const tourSteps = [
  ["filters", "Filter op dienst", "Tik op FILTERS om alleen een bepaalde bron, of alleen films of series te zien."],
  ["swipe", "Swipe door kijktips", "Swipe links en rechts, of gebruik de pijltjes. Tik op een kaart voor details en kijk meteen gratis."],
  ["bookmark", "Bewaar op je lijst", "Voeg titels toe aan Mijn lijsten, zodat je nooit meer hoeft te zoeken waar het staat."],
  ["plus", "Voeg zelf toe", "Plak onder Zoek een YouTube-, Vimeo-, Dailymotion- of videolink om je eigen titels toe te voegen."],
];

export function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [icon, title, text] = tourSteps[i];
  const last = i === tourSteps.length - 1;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet text-center" onClick={(e) => e.stopPropagation()}>
        <div className="tour-icon"><Icon name={icon} size={44} /></div>
        <h5>{title}</h5>
        <p className="text-secondary">{text}</p>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-dark flex-fill" onClick={onClose}>Overslaan</button>
          <button className="btn btn-dark flex-fill" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "Klaar" : `Volgende (${i + 1}/${tourSteps.length})`}</button>
        </div>
      </div>
    </div>
  );
}

export function Detail({ title, service, entry, user, onSave, onRemove, onLogin, onClose, onPlay }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-scroll" onClick={(e) => e.stopPropagation()}>
        <span className="tag" style={{ background: service?.color }}>{service?.name}</span>
        <small className="d-block text-secondary mt-2">{label(title)}{title.runtime && ` · ${title.runtime}`}</small>
        <h4>{title.title}</h4>
        <p>{title.why}</p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {isPlayable(title) && <button className="btn btn-danger flex-fill" onClick={() => onPlay(title)}><Icon name="play" size={14} /> Kijk nu gratis</button>}
          {title.deepLink && <button className="btn btn-danger flex-fill" onClick={() => openInApp(title.deepLink)}><Icon name="play" size={14} /> Open {title.linkName || "link"}</button>}
        </div>
        {title.custom ? null : user ? (
          <EntryEditor entry={entry} onSave={onSave} onRemove={onRemove} />
        ) : (
          <button className="btn btn-outline-dark w-100" onClick={onLogin}>Log in om te bewaren en te beoordelen</button>
        )}
      </div>
    </div>
  );
}

// Plays free titles: HTML5 <video> for direct files (Internet Archive files are resolved by the backend),
// falling back to the source's own embed when no file can be played
export function Player({ title, onClose }) {
  const [src, setSrc] = useState(title.videoUrl || null);
  const [resolving, setResolving] = useState(!title.videoUrl && Boolean(title.archiveId));
  const [useEmbed, setUseEmbed] = useState(false);
  const embed = title.youtubeId
    ? `https://www.youtube.com/embed/${title.youtubeId}?autoplay=1&rel=0&playsinline=1`
    : title.archiveId ? `https://archive.org/embed/${title.archiveId}` : title.embedUrl;

  useEffect(() => {
    if (!resolving) return;
    api.archiveVideo(title.archiveId).then((r) => setSrc(r.url)).catch(() => {}).finally(() => setResolving(false));
  }, [resolving, title.archiveId]);

  const showVideo = src && !useEmbed;
  return (
    <div className="player">
      <div className="player-bar">
        <button className="pill-btn" onClick={onClose}><Icon name="back" size={16} /> Terug</button>
        <strong className="text-truncate">{title.title}</strong>
      </div>
      {resolving ? (
        <p className="text-center text-white-50 p-4">Video laden…</p>
      ) : showVideo ? (
        <video src={src} poster={title.poster} controls autoPlay playsInline preload="metadata" onError={() => (embed ? setUseEmbed(true) : setSrc(null))} />
      ) : embed ? (
        <iframe title={title.title} src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <p className="text-center text-white p-4">Deze video kon niet geladen worden. Controleer je internetverbinding.</p>
      )}
    </div>
  );
}

export function Toast({ message }) {
  return message ? <div className="toast-msg">{message}</div> : null;
}

// Native Android: the site loads in a full-window WebView inside the app (with back/forward/close toolbar).
// Web preview: falls back to an iframe, which many streaming sites block.
export function WebFrame({ url, onClose }) {
  const native = Boolean(window.Capacitor?.isNativePlatform?.());
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw url */ }

  useEffect(() => {
    if (!native) return;
    let plugin;
    let dead = false;
    let sub;
    (async () => {
      const mod = await import("@capgo/inappbrowser");
      plugin = mod.InAppBrowser;
      sub = await plugin.addListener("closeEvent", () => { if (!dead) onClose(); });
      await plugin.openWebView({ url, title: host, toolbarType: mod.ToolBarType.NAVIGATION, toolbarColor: "#10242f", toolbarTextColor: "#f6f1e8", showReloadButton: true });
      if (dead) plugin.close();
    })().catch(() => { openLink(url); onClose(); });
    return () => { dead = true; sub?.remove?.(); plugin?.close().catch(() => {}); };
  }, [url, native]);

  if (native) return null;
  return (
    <div className="player">
      <div className="player-bar">
        <button className="pill-btn" onClick={onClose}><Icon name="back" size={16} /> Terug</button>
        <strong className="text-truncate">{host}</strong>
        <button className="pill-btn ms-auto" onClick={() => openLink(url)}>Open in app</button>
      </div>
      <div className="webframe-body"><iframe title={host} src={url} allow="autoplay; fullscreen; encrypted-media" allowFullScreen /></div>
      <small className="text-white-50 p-2 text-center">Zie je niets? Deze site staat inbedden in een webbrowser niet toe; in de Android-app laadt hij wel in het venster.</small>
    </div>
  );
}
