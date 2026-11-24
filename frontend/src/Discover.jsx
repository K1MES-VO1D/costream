import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

const bg = (t) => ({ "--c1": t.colors[0], "--c2": t.colors[1] });
const label = (t) => `${t.type === "film" ? "Film" : "Serie"} · ${t.year}`;
const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
export const isPlayable = (t) => Boolean(t.videoUrl || t.embedUrl || t.youtubeId);

function PlayButton({ title, service, onPlay }) {
  if (isPlayable(title)) return <button className="pill-btn play" onClick={stop(() => onPlay(title))}>▶ Kijk nu gratis</button>;
  if (service?.watchUrl) return <button className="pill-btn play" onClick={stop(() => openService(service, title))}>▶ Kijk op {service.name}</button>;
  return null;
}

function WatchButton({ saved, onToggle }) {
  return (
    <button className={`pill-btn ${saved ? "saved" : ""}`} onClick={stop(onToggle)}>
      {saved ? "✓ Op mijn lijst" : "+ Mijn lijst"}
    </button>
  );
}

// Intro/promo cards shown before the personal tips
const promoCards = [
  { id: "welcome", tag: "Welkom", title: "Welkom bij Difonti: al je streamingdiensten op één plek.", art: "📺", cta: "Doe de tour", action: "tour", cls: "welcome" },
  { id: "bundle", tag: "Bundelkorting", title: "Combineer 3 diensten en bespaar 15% op je maandbedrag.", art: "💶", cta: "Bekijk bundels", action: "services", cls: "promo-green" },
  { id: "tips", tag: "Zo werkt het", title: "Swipe door tips, bewaar wat je wilt kijken en zie direct waar het staat.", art: "👉", cta: "Naar mijn lijsten", action: "lists", cls: "promo-purple" },
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
              <div className="welcome-art">{c.art}</div>
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
        <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Vorige">‹</button>
        <button onClick={() => go(index + 1)} disabled={index >= count - 1} aria-label="Volgende">›</button>
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

// Lets the user add any free-to-watch YouTube movie by pasting its link; title/thumbnail come from YouTube oEmbed
function YoutubeAdder({ onAdd }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("film");
  const [msg, setMsg] = useState("");
  const add = async (e) => {
    e.preventDefault();
    const id = youtubeId(url);
    if (!id) return setMsg("Geen geldige YouTube-link.");
    setMsg("Bezig…");
    try {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
      const info = await res.json();
      onAdd({ id: `yt-${id}`, title: info.title, type: kind, year: new Date().getFullYear(), serviceId: "gratis", why: `Gratis op YouTube van ${info.author_name}.`, colors: ["#b71c1c", "#ef9a9a"], free: true, custom: true, youtubeId: id, poster: info.thumbnail_url });
      setUrl("");
      setMsg(`${kind === "film" ? "Film" : "Serie"} toegevoegd onder Gratis!`);
    } catch {
      setMsg("Kon deze video niet ophalen (offline of niet publiek).");
    }
  };
  return (
    <form onSubmit={add} className="mb-3">
      <div className="input-group">
        <input className="form-control" placeholder="Plak een gratis YouTube film/serie link" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 100 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="film">Film</option>
          <option value="series">Serie</option>
        </select>
        <button className="btn btn-danger">+</button>
      </div>
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
      <YoutubeAdder onAdd={onAddCustom} />
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
  ["🔎", "Filter op dienst", "Tik op FILTERS om alleen titels van jouw streamingdiensten, of alleen films of series te zien."],
  ["👉", "Swipe door kijktips", "Swipe links en rechts, of gebruik de pijltjes. Tik op een kaart voor details en waar je kijkt."],
  ["🔖", "Bewaar op je lijst", "Voeg titels toe aan Mijn lijsten, zodat je nooit meer hoeft te zoeken waar het staat."],
  ["💶", "Beheer je abonnementen", "Via je account zie je al je diensten en bundelkorting in één overzicht."],
];

export function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [icon, title, text] = tourSteps[i];
  const last = i === tourSteps.length - 1;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet text-center" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "3rem" }}>{icon}</div>
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
          {isPlayable(title) && <button className="btn btn-danger flex-fill" onClick={() => onPlay(title)}>▶ Kijk nu gratis</button>}
          {!title.free && service?.watchUrl && <button className="btn btn-danger flex-fill" onClick={() => openService(service, title)}>▶ Kijk op {service.name}</button>}
          {!title.custom && <button className={`btn flex-fill ${saved ? "btn-dark" : "btn-outline-dark"}`} onClick={onToggle}>{saved ? "✓ Op mijn lijst" : "+ Mijn lijst"}</button>}
          {!title.free && !current && <button className="btn btn-primary flex-fill" onClick={() => (user ? onSubscribe(cheapest.id) : onLogin())}>{user ? `Abonneer op ${service?.name}` : "Log in om te abonneren"}</button>}
        </div>
      </div>
    </div>
  );
}

// Plays direct video (HTML5), Internet Archive embeds, or YouTube embeds
export async function openService(service, title) {
  if (!service?.watchUrl) return;
  const url = service.watchUrl.replace("{q}", encodeURIComponent(title.title));
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}
export function Player({ title, onClose }) {
  const [failed, setFailed] = useState(false);
  const embed = title.youtubeId ? `https://www.youtube.com/embed/${title.youtubeId}?autoplay=1&rel=0&playsinline=1` : title.embedUrl;
  return (
    <div className="player">
      <div className="player-bar">
        <button className="pill-btn" onClick={onClose}>← Terug</button>
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
