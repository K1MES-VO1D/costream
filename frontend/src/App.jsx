import { useEffect, useState } from "react";
import { api } from "./api.js";
import { AuthForm } from "./Parts.jsx";
import { Lists, Account } from "./Library.jsx";
import { Tips, Search, Tour, Detail, Player, WebFrame, Toast } from "./Discover.jsx";
import { Icon, Logo } from "./Icons.jsx";

function FiltersSheet({ services, active, setActive, type, setType, onClose }) {
  const toggle = (id) => setActive(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h5 className="mb-3">Filters</h5>
        <p className="small text-secondary mb-2">Bron</p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {services.map((s) => (
            <button key={s.id} className={`btn btn-sm ${active.includes(s.id) ? "btn-dark" : "btn-outline-dark"}`} onClick={() => toggle(s.id)}>{s.name}</button>
          ))}
        </div>
        <p className="small text-secondary mb-2">Type</p>
        <div className="d-flex gap-2 mb-4">
          {[["", "Alles"], ["film", "Films"], ["series", "Series"]].map(([v, l]) => (
            <button key={v} className={`btn btn-sm ${type === v ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-dark flex-fill" onClick={() => { setActive([]); setType(""); }}>Wissen</button>
          <button className="btn btn-dark flex-fill" onClick={onClose}>Toepassen</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [services, setServices] = useState([]);
  const [titles, setTitles] = useState([]);
  const [library, setLibrary] = useState([]);
  const watch = Object.fromEntries(library.map((e) => [e.id, e.status]));
  const [view, setView] = useState("tips");
  const [pie, setPie] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeServices, setActiveServices] = useState([]);
  const [type, setType] = useState("");
  const [tour, setTour] = useState(false);
  const [detail, setDetail] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [frameUrl, setFrameUrl] = useState(null);
  useEffect(() => {
    const h = (e) => setFrameUrl(e.detail.url);
    window.addEventListener("difonti-frame", h);
    return () => window.removeEventListener("difonti-frame", h);
  }, []);
  const [custom, setCustom] = useState(() => JSON.parse(localStorage.getItem("customTitles") || "[]"));
  const addCustom = (t) => {
    const next = [t, ...custom.filter((c) => c.id !== t.id)];
    setCustom(next);
    localStorage.setItem("customTitles", JSON.stringify(next));
  };
  const [toast, setToast] = useState("");

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  useEffect(() => {
    api.services().then(setServices).catch((e) => setError(e.message));
    api.titles().then(setTitles).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return setLibrary([]);
    api.library().then(setLibrary).catch(() => {});
  }, [user]);

  const onAuth = ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    setView("tips");
  };
  const logout = (deleted) => {
    if (deleted !== true) api.logout().catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setLibrary([]);
    setView("tips");
  };
  useEffect(() => {
    const h = () => { logout(true); notify("Sessie verlopen, log opnieuw in"); };
    window.addEventListener("difonti-expired", h);
    return () => window.removeEventListener("difonti-expired", h);
  }, []);
  const saveEntry = async (id, patch) => {
    try {
      const e = await api.saveEntry(id, patch);
      setLibrary((l) => [e, ...l.filter((x) => x.id !== id)]);
      return e;
    } catch (err) { setError(err.message); setTimeout(() => setError(""), 3000); }
  };
  const removeEntry = async (id) => {
    try { await api.removeEntry(id); setLibrary((l) => l.filter((x) => x.id !== id)); } catch (err) { setError(err.message); }
  };
  const toggleWatch = async (id) => {
    if (!user) { notify("Log in om titels te bewaren"); return setView("account"); }
    if (watch[id]) { await removeEntry(id); notify("Verwijderd van mijn lijsten"); }
    else if (await saveEntry(id, { status: "planned" })) notify("Toegevoegd: Wil ik kijken");
  };
  const onAction = (a) => (a === "tour" ? setTour(true) : setView(a));

  const filtered = [...titles, ...custom].filter((t) => (!activeServices.length || activeServices.includes(t.serviceId)) && (!type || t.type === type));
  const common = { services, watch, onToggle: toggleWatch, onOpen: setDetail, onPlay: (t) => { setDetail(null); setPlaying(t); } };
  const filterCount = activeServices.length + (type ? 1 : 0);

  const pages = {
    lists: ["Mijn lijsten", <Lists library={library} services={services} user={user} onLogin={() => setView("account")} onOpen={setDetail} />],
    search: ["Zoek", <Search {...common} custom={custom} onAddCustom={addCustom} />],
    account: ["Account", user ? (
      <Account user={user} library={library} notify={notify} onLogout={logout} onUser={(u) => { setUser(u); localStorage.setItem("user", JSON.stringify(u)); }} />
    ) : <AuthForm onAuth={onAuth} />],
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setView("tips")} aria-label="Home"><Logo /></button>
        <button className="filters-btn" onClick={() => setShowFilters(true)}>
          <Icon name="filters" size={22} /> FILTERS{filterCount ? ` (${filterCount})` : ""}
        </button>
        <button className="icon-btn" onClick={() => setView("account")} aria-label="Account"><Icon name="user" size={30} /></button>
      </header>

      {error && <div className="alert alert-danger mx-3 mb-2 py-2">{error}</div>}

      {view === "tips" ? (
        <Tips {...common} titles={filtered} onAction={onAction} />
      ) : (
        <section className="page">
          <h1 className="h4 text-white mb-3">{pages[view][0]}</h1>
          {pages[view][1]}
        </section>
      )}


      {pie && <div className="pie-backdrop" onClick={() => setPie(false)} />}
      <div className={`pie ${pie ? "open" : ""}`} aria-hidden={!pie}>
        {[
          ["Home", "home", () => setView("tips")],
          ["Lijsten", "list", () => setView("lists")],
          ["Zoek", "search", () => setView("search")],
          ["Link", "link", () => setView("search")],
          ["Filters", "filters", () => setShowFilters(true)],
          ["Tour", "info", () => setTour(true)],
          ["Account", "user", () => setView("account")],
        ].map(([label, icon, run], i, a) => (
          <button key={label} tabIndex={pie ? 0 : -1} className="pie-item" style={{ "--a": `${180 - (i * 180) / (a.length - 1)}deg`, "--i": i }} onClick={() => { setPie(false); run(); }}>
            <Icon name={icon} size={24} /><span>{label}</span>
          </button>
        ))}
      </div>

      <nav className="bottom-nav">
        <button className={view === "lists" ? "active" : ""} onClick={() => setView("lists")}><Icon name="list" /><span>Mijn lijsten</span></button>
        <button className={`center ${pie ? "open" : ""} ${view === "tips" ? "active" : ""}`} onClick={() => setPie((o) => !o)} aria-expanded={pie} aria-label="Menu"><Icon name={pie ? "plus" : "cards"} /><span>Home</span></button>
        <button className={view === "search" ? "active" : ""} onClick={() => setView("search")}><Icon name="search" /><span>Zoek</span></button>
      </nav>

      {showFilters && (
        <FiltersSheet services={services} active={activeServices} setActive={setActiveServices} type={type} setType={setType} onClose={() => { setShowFilters(false); setView("tips"); }} />
      )}
      {tour && <Tour onClose={() => setTour(false)} />}
      {detail && (
        <Detail
          title={detail}
          service={services.find((s) => s.id === detail.serviceId)}
          entry={library.find((e) => e.id === detail.id)}
          user={user}
          onSave={(patch) => saveEntry(detail.id, patch)}
          onRemove={() => removeEntry(detail.id)}
          onLogin={() => { setDetail(null); setView("account"); }}
          onClose={() => setDetail(null)}
          onPlay={common.onPlay}
        />
      )}
      {frameUrl && <WebFrame url={frameUrl} onClose={() => setFrameUrl(null)} />}
      {playing && <Player title={playing} onClose={() => setPlaying(null)} />}
      <Toast message={toast} />
    </div>
  );
}
