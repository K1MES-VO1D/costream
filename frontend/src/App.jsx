import { useEffect, useState } from "react";
import { api } from "./api.js";
import { AuthForm, ServiceCard, money, emptySummary } from "./Parts.jsx";
import { Tips, Search, Lists, Tour, Detail, Player, Toast } from "./Discover.jsx";
import { Icon, Logo } from "./Icons.jsx";

function Summary({ summary, user }) {
  return (
    <div className="card mt-3">
      <div className="card-header fw-semibold">Jouw abonnementen</div>
      <ul className="list-group list-group-flush">
        {summary.items.length === 0 && <li className="list-group-item text-secondary">{user ? "Nog geen actieve abonnementen." : "Log in om abonnementen te beheren."}</li>}
        {summary.items.map((i) => (
          <li key={i.serviceId} className="list-group-item d-flex justify-content-between">
            <span><span className="badge me-2" style={{ background: i.color }}>&nbsp;</span>{i.serviceName} <small className="text-secondary">{i.plan.name}</small></span>
            <span>{money(i.plan.price)}</span>
          </li>
        ))}
      </ul>
      <div className="card-body">
        <div className="d-flex justify-content-between"><span>Subtotaal</span><span>{money(summary.subtotal)}</span></div>
        <div className="d-flex justify-content-between text-success"><span>Bundelkorting ({Math.round(summary.discountRate * 100)}%)</span><span>-{money(summary.discount)}</span></div>
        <hr />
        <div className="d-flex justify-content-between fw-bold fs-5"><span>Totaal per maand</span><span>{money(summary.total)}</span></div>
        <small className="text-secondary">2 diensten: 10% · 3: 15% · 4+: 20% korting</small>
      </div>
    </div>
  );
}

function FiltersSheet({ services, active, setActive, type, setType, onClose }) {
  const toggle = (id) => setActive(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h5 className="mb-3">Filters</h5>
        <p className="small text-secondary mb-2">Streamingdienst</p>
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
  const [watch, setWatch] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [view, setView] = useState("tips");
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeServices, setActiveServices] = useState([]);
  const [type, setType] = useState("");
  const [tour, setTour] = useState(false);
  const [detail, setDetail] = useState(null);
  const [playing, setPlaying] = useState(null);
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
    if (!user) { setWatch([]); return setSummary(emptySummary); }
    api.subscriptions().then(setSummary).catch(() => logout());
    api.watchlist().then(setWatch).catch(() => {});
  }, [user]);

  const onAuth = ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    setView("tips");
  };
  const logout = () => {
    localStorage.clear();
    setUser(null);
  };
  const act = (fn, message) => async (...args) => {
    setError("");
    try { setSummary(await fn(...args)); if (message) notify(message); } catch (e) { setError(e.message); }
  };
  const toggleWatch = async (id) => {
    if (!user) { notify("Log in om titels te bewaren"); return setView("account"); }
    const adding = !watch.includes(id);
    try { setWatch(await (adding ? api.addWatch(id) : api.removeWatch(id))); notify(adding ? "Toegevoegd aan Mijn lijst" : "Verwijderd van Mijn lijst"); } catch (e) { setError(e.message); }
  };
  const onAction = (a) => (a === "tour" ? setTour(true) : setView(a));

  const currentFor = (id) => summary.items.find((i) => i.serviceId === id);
  const filtered = [...titles, ...custom].filter((t) => (!activeServices.length || activeServices.includes(t.serviceId)) && (!type || t.type === type));
  const common = { services, watch, onToggle: toggleWatch, onOpen: setDetail, onPlay: (t) => { setDetail(null); setPlaying(t); } };
  const filterCount = activeServices.length + (type ? 1 : 0);

  const pages = {
    lists: ["Mijn lijsten", <Lists {...common} titles={titles} user={user} onLogin={() => setView("account")} />],
    search: ["Zoek", <Search {...common} custom={custom} onAddCustom={addCustom} />],
    account: ["Account", user ? (
      <div className="card card-body text-center">
        <h4>Hoi, {user.name}</h4>
        <p className="text-secondary">{user.email}</p>
        <button className="btn btn-primary mb-2" onClick={() => setView("services")}>Mijn abonnementen</button>
        <button className="btn btn-outline-danger" onClick={logout}>Uitloggen</button>
      </div>
    ) : <AuthForm onAuth={onAuth} />],
    services: ["Mijn abonnementen", (
      <>
        <div className="row g-3">
          {services.filter((s) => !s.free).map((s) => (
            <div key={s.id} className="col-12">
              <ServiceCard service={s} current={currentFor(s.id)} user={user} onLogin={() => setView("account")} onSubscribe={act(api.subscribe, "Abonnement bijgewerkt")} onCancel={act(api.cancel, "Abonnement opgezegd")} />
            </div>
          ))}
        </div>
        <Summary summary={summary} user={user} />
      </>
    )],
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

      <nav className="bottom-nav">
        <button className={view === "lists" ? "active" : ""} onClick={() => setView("lists")}><Icon name="list" /><span>Mijn lijsten</span></button>
        <button className={`center ${view === "tips" ? "active" : ""}`} onClick={() => setView("tips")}><Icon name="cards" /><span>Home</span></button>
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
          saved={watch.includes(detail.id)}
          current={currentFor(detail.serviceId)}
          user={user}
          onToggle={() => toggleWatch(detail.id)}
          onLogin={() => { setDetail(null); setView("account"); }}
          onSubscribe={(planId) => act(api.subscribe, "Abonnement bijgewerkt")(detail.serviceId, planId).then(() => setDetail(null))}
          onClose={() => setDetail(null)}
          onPlay={common.onPlay}
        />
      )}
      {playing && <Player title={playing} onClose={() => setPlaying(null)} />}
      <Toast message={toast} />
    </div>
  );
}
