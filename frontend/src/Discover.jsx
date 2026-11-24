import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./Icons.jsx";
import { normalizeLink, detectService, openLink, openInApp } from "./deeplinks.js";

const bg = (t) => ({ "--c1": t.colors[0], "--c2": t.colors[1] });
const label = (t) => `${t.type === "film" ? "Film" : "Serie"} · ${t.year}`;
const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
export const isPlayable = (t) => Boolean(t.videoUrl || t.embedUrl || t.youtubeId);

function PlayButton({ title, service, onPlay }) {
  if (isPlayable(title)) return <button className="pill-btn play" onClick={stop(() => onPlay(title))}><Icon name="play" size={14} /> Kijk nu gratis</button>;
  if (title.deepLink) return <button className="pill-btn play" onClick={stop(() => openInApp(title.deepLink))}><Icon name="play" size={14} /> Kijk op {title.linkName || service?.name}</button>;
  if (service?.watchUrl) return <button className="pill-btn play" onClick={stop(() => openService(service, title))}><Icon name="play" size={14} /> Kijk op {service.name}</button>;
  return null;
}

function WatchButton({ saved, onToggle }) {
  return (
    <button className={`pill-btn ${saved ? "saved" : ""}`} onClick={stop(onToggle)}>
      <Icon name={saved ? "check" : "plus"} size={14} /> {saved ? "Op mijn lijst" : "Mijn lijst"}
    </button>
  );
}

// Intro/promo cards shown before the personal tips
const promoCards = [
  { id: "welcome", tag: "Welkom", title: "Welkom bij Difonti: al je streamingdiensten op één plek.", art: "tv", cta: "Doe de tour", action: "tour", cls: "welcome" },
  { id: "bundle", tag: "Bundelkorting", title: "Combineer 3 diensten en bespaar 15% op je maandbedrag.", art: "wallet", cta: "Bekijk bundels", action: "services", cls: "promo-green" },
  { id: "tips", tag: "Zo werkt het", title: "Swipe door tips, bewaar wat je wilt kijken en zie direct waar het staat.", art: "swipe", cta: "Naar mijn lijsten", action: "lists", cls: "promo-purple" },
];

// Swipeable "kijktips": the next card peeks in; works with touch and mouse drag
export function Tips({ titles, services, watch, onToggle, onOpen, onPlay, onAction }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [index, setIndex] = useState(0);
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
          <article key={t.id} className="tip-card clickable" style={bg(t)} onClick={() => open(t)}>
            <div className="tip-content">
              <span className="tag">{services.find((s) => s.id === t.serviceId)?.name}</span>
              <small className="meta">{label(t)}</small>
              <h2>{t.title}</h2>
              <p>{t.why}</p>
              <div className="d-flex flex-wrap gap-2">
                <PlayButton title={t} service={services.find((s) => s.id === t.serviceId)} onPlay={onPlay} />
                <WatchButton saved={watch.includes(t.id)} onToggle={() => onToggle(t.id)} />
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
              <PlayButton title={t} service={services.find((s) => s.id === t.serviceId)} onPlay={onPlay} />
              {!t.custom && <WatchButton saved={watch.includes(t.id)} onToggle={() => onToggle(t.id)} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const youtubeId = (url) => url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1];

// Paste any link: YouTube plays inside the app; streaming-service links and app deep links open in that app
function LinkAdder({ onAdd }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("film");
  const [msg, setMsg] = useState("");
  const add = async (e) => {
    e.preventDefault();
    const link = normalizeLink(url);
    if (!link) return setMsg("Geen geldige link.");
    const base = { type: kind, year: new Date().getFullYear(), custom: true };
    const yt = youtubeId(link);
    if (yt) {
      setMsg("Bezig…");
      let info = {};
      try {
        info = await (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`)).json();
      } catch { /* offline: fall back to the typed name */ }
      const title = info.title || name.trim();
      if (!title) return setMsg("Kon de titel niet ophalen; vul zelf een naam in.");
      onAdd({ ...base, id: `yt-${yt}`, title, serviceId: "gratis", why: `Gratis op YouTube${info.author_name ? ` van ${info.author_name}` : ""}.`, colors: ["#8c3b2a", "#e0a58f"], free: true, youtubeId: yt, poster: info.thumbnail_url });
    } else {
      const { serviceId, host } = detectService(link);
      const title = name.trim();
      if (!title) return setMsg("Geef de titel een naam.");
      onAdd({ ...base, id: `link-${Date.now()}`, title, serviceId: serviceId || "gratis", why: `Opent direct via ${serviceId ? "je streamingdienst" : host || "je app"}.`, colors: ["#2f5d73", "#8fb8c9"], free: !serviceId, deepLink: link, linkName: serviceId ? undefined : host || "link" });
    }
    setUrl("");
    setName("");
    setMsg("Toegevoegd!");
  };
  return (
    <form onSubmit={add} className="mb-3">
      <div className="input-group mb-2">
        <input className="form-control" placeholder="Plak een link (YouTube, Netflix, app-link…)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 100 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="film">Film</option>
          <option value="series">Serie</option>
        </select>
        <button className="btn btn-danger" aria-label="Toevoegen"><Icon name="plus" size={18} /></button>
      </div>
      {url && !youtubeId(url) && <input className="form-control mb-1" placeholder="Naam van de titel" value={name} onChange={(e) => setName(e.target.value)} />}
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
        {[{ id: "", name: "Alle diensten" }, ...props.services].map((s) => (
          <button key={s.id} className={`btn btn-sm ${service === s.id ? "btn-light" : "btn-outline-light"}`} onClick={() => setService(s.id)}>{s.name}</button>
        ))}
      </div>
      <LinkAdder onAdd={onAddCustom} />
      <PosterGrid {...props} titles={shown} />
    </>
  );
}

export function Lists({ titles, watch, user, onLogin, ...rest }) {
  if (!user)
    return (
      <div className="text-center py-5 text-white">
        <p>Log in om je lijsten te bewaren.</p>
        <button className="btn btn-light" onClick={onLogin}>Inloggen</button>
      </div>
    );
  return watch.length ? (
    <PosterGrid {...rest} watch={watch} titles={titles.filter((t) => watch.includes(t.id))} />
  ) : (
    <p className="text-white-50">Nog niets bewaard. Tik op “+ Mijn lijst” bij een titel om te beginnen.</p>
  );
}

const tourSteps = [
  ["filters", "Filter op dienst", "Tik op FILTERS om alleen titels van jouw streamingdiensten, of alleen films of series te zien."],
  ["swipe", "Swipe door kijktips", "Swipe links en rechts, of gebruik de pijltjes. Tik op een kaart voor details en waar je kijkt."],
  ["bookmark", "Bewaar op je lijst", "Voeg titels toe aan Mijn lijsten, zodat je nooit meer hoeft te zoeken waar het staat."],
  ["wallet", "Beheer je abonnementen", "Via je account zie je al je diensten en bundelkorting in één overzicht."],
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

export function Detail({ title, service, saved, onToggle, onClose, current, onSubscribe, onPlay, user, onLogin }) {
  const cheapest = service?.plans[0];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="tag" style={{ background: service?.color }}>{service?.name}</span>
        <small className="d-block text-secondary mt-2">{label(title)}{title.runtime && ` · ${title.runtime}`}</small>
        <h4>{title.title}</h4>
        <p>{title.why}</p>
        {!title.free && (
          <p className="small text-secondary">
            Kijken via {service?.name}{cheapest && ` vanaf ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cheapest.price)} per maand`}.
            {current && " Je bent al geabonneerd."}
          </p>
        )}
        <div className="d-flex flex-wrap gap-2">
          {isPlayable(title) && <button className="btn btn-danger flex-fill" onClick={() => onPlay(title)}><Icon name="play" size={14} /> Kijk nu gratis</button>}
          {title.deepLink && <button className="btn btn-danger flex-fill" onClick={() => openInApp(title.deepLink)}><Icon name="play" size={14} /> Kijk op {title.linkName || service?.name}</button>}
          {!title.deepLink && !title.free && service?.watchUrl && <button className="btn btn-danger flex-fill" onClick={() => openService(service, title)}><Icon name="play" size={14} /> Kijk op {service.name}</button>}
          {(title.deepLink || (!title.free && service?.watchUrl)) && <button className="btn btn-outline-dark flex-fill" onClick={() => openLink(title.deepLink || service.watchUrl.replace("{q}", encodeURIComponent(title.title)))}>Open in {title.linkName || service?.name}-app</button>}
          {!title.custom && <button className={`btn flex-fill ${saved ? "btn-dark" : "btn-outline-dark"}`} onClick={onToggle}><Icon name={saved ? "check" : "plus"} size={14} /> {saved ? "Op mijn lijst" : "Mijn lijst"}</button>}
          {!title.free && !current && <button className="btn btn-primary flex-fill" onClick={() => (user ? onSubscribe(cheapest.id) : onLogin())}>{user ? `Abonneer op ${service?.name}` : "Log in om te abonneren"}</button>}
        </div>
      </div>
    </div>
  );
}

// Plays direct video (HTML5), Internet Archive embeds, or YouTube embeds
export async function openService(service, title) {
  if (!service?.watchUrl) return;
  await openInApp(service.watchUrl.replace("{q}", encodeURIComponent(title.title)));
}
export function Player({ title, onClose }) {
  const [failed, setFailed] = useState(false);
  const embed = title.youtubeId ? `https://www.youtube.com/embed/${title.youtubeId}?autoplay=1&rel=0&playsinline=1` : title.embedUrl;
  return (
    <div className="player">
      <div className="player-bar">
        <button className="pill-btn" onClick={onClose}><Icon name="back" size={16} /> Terug</button>
        <strong className="text-truncate">{title.title}</strong>
      </div>
      {embed ? (
        <>
          <iframe title={title.title} src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          <a className="pill-btn m-3 text-center text-decoration-none" href={title.youtubeId ? `https://www.youtube.com/watch?v=${title.youtubeId}` : title.embedUrl} target="_blank" rel="noreferrer">Opent niet? Open in browser</a>
        </>
      ) : failed ? (
        <p className="text-center text-white p-4">Deze video kon niet geladen worden. Controleer je internetverbinding.</p>
      ) : (
        <video src={title.videoUrl} controls autoPlay playsInline onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function Toast({ message }) {
  return message ? <div className="toast-msg">{message}</div> : null;
}

// iframe-style panel: on Android a native WebView is placed exactly over the panel body
// (streaming sites refuse real iframes); on the web an iframe is used where the site allows it
export function WebFrame({ url, onClose }) {
  const body = useRef(null);
  const native = Boolean(window.Capacitor?.isNativePlatform?.());
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw url */ }

  useEffect(() => {
    if (!native) return;
    let plugin;
    let dead = false;
    (async () => {
      const mod = await import("@capgo/inappbrowser");
      plugin = mod.InAppBrowser;
      const r = body.current.getBoundingClientRect();
      const k = window.devicePixelRatio || 1;
      await plugin.openWebView({
        url,
        toolbarType: mod.ToolBarType.BLANK,
        x: Math.round(r.left * k), y: Math.round(r.top * k),
        width: Math.round(r.width * k), height: Math.round(r.height * k),
      });
      if (dead) plugin.close();
    })().catch(() => openLink(url));
    return () => { dead = true; plugin?.close().catch(() => {}); };
  }, [url, native]);

  return (
    <div className="player">
      <div className="player-bar">
        <button className="pill-btn" onClick={onClose}><Icon name="back" size={16} /> Terug</button>
        <strong className="text-truncate">{host}</strong>
        <button className="pill-btn ms-auto" onClick={() => openLink(url)}>Open in app</button>
      </div>
      <div ref={body} className="webframe-body">
        {!native && <iframe title={host} src={url} allow="autoplay; fullscreen; encrypted-media" allowFullScreen />}
      </div>
      {!native && <small className="text-white-50 p-2 text-center">Zie je niets? Deze site staat inbedden in een webbrowser niet toe; in de Android-app opent hij wel in dit venster.</small>}
    </div>
  );
}
