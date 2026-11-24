import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./Icons.jsx";

export const STATUS_LABEL = { watching: "Kijk ik", planned: "Wil ik kijken", completed: "Gezien", onhold: "Pauze", dropped: "Gestopt" };
const STATUSES = Object.keys(STATUS_LABEL);

// Status, score and note for one title (saves immediately, like Apple's settings rows)
export function EntryEditor({ entry, onSave, onRemove }) {
  const [note, setNote] = useState(entry?.note || "");
  return (
    <div className="entry-editor">
      <div className="segmented">
        {STATUSES.map((s) => (
          <button key={s} className={entry?.status === s ? "on" : ""} onClick={() => onSave({ status: s })}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      {entry && (
        <>
          <label className="entry-row">
            <span>Cijfer</span>
            <select value={entry.score} onChange={(e) => onSave({ score: Number(e.target.value) })}>
              <option value={0}>Geen</option>
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <textarea className="form-control" rows={2} maxLength={500} placeholder="Notitie (optioneel)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== entry.note && onSave({ note })} />
          <button className="btn btn-link text-danger p-0 mt-2" onClick={onRemove}>Verwijderen van mijn lijsten</button>
        </>
      )}
    </div>
  );
}

const SORTS = {
  recent: ["Recent", (a, b) => b.updated - a.updated],
  score: ["Cijfer", (a, b) => b.score - a.score || b.updated - a.updated],
  title: ["Titel", (a, b) => a.item.title.localeCompare(b.item.title, "nl")],
};

export function Lists({ library, services, user, onLogin, onOpen }) {
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("recent");
  if (!user)
    return (
      <div className="text-center py-5 text-white">
        <p>Log in om je lijsten te bewaren.</p>
        <button className="btn btn-light" onClick={onLogin}>Inloggen</button>
      </div>
    );
  const scored = library.filter((e) => e.score > 0);
  const mean = scored.length ? (scored.reduce((n, e) => n + e.score, 0) / scored.length).toFixed(1) : "–";
  const count = (s) => library.filter((e) => e.status === s).length;
  const rows = library.filter((e) => tab === "all" || e.status === tab).sort(SORTS[sort][1]);
  return (
    <>
      <div className="stats">
        <div><b>{library.length}</b><span>Titels</span></div>
        <div><b>{count("completed")}</b><span>Gezien</span></div>
        <div><b>{mean}</b><span>Gemiddeld</span></div>
      </div>
      <div className="tabs">
        {[["all", "Alles", library.length], ...STATUSES.map((s) => [s, STATUS_LABEL[s], count(s)])].map(([k, l, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l} <small>{n}</small></button>
        ))}
      </div>
      {library.length > 1 && (
        <label className="sort">Sorteer
          <select value={sort} onChange={(e) => setSort(e.target.value)}>{Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
      )}
      {!rows.length ? (
        <p className="text-white-50 mt-3">{library.length ? "Niets in deze lijst." : "Nog niets bewaard. Open een titel en kies “Wil ik kijken”."}</p>
      ) : (
        <ul className="lib-list">
          {rows.map((e) => (
            <li key={e.id} onClick={() => onOpen(e.item)}>
              <div className="thumb" style={{ "--c1": e.item.colors?.[0], "--c2": e.item.colors?.[1], backgroundImage: `${e.item.poster ? `url(${e.item.poster}), ` : ""}linear-gradient(160deg, ${e.item.colors?.[0]}, ${e.item.colors?.[1]})` }} />
              <div className="meta">
                <strong>{e.item.title}</strong>
                <small>{e.item.type === "film" ? "Film" : "Serie"} · {e.item.year} · {services.find((s) => s.id === e.item.serviceId)?.name}</small>
                <span className={`chip ${e.status}`}>{STATUS_LABEL[e.status]}</span>
              </div>
              <div className="score">{e.score || "–"}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const Field = ({ label, ...p }) => (
  <label className="d-block mb-2"><small className="text-secondary">{label}</small><input className="form-control" {...p} /></label>
);

export function Account({ user, library, onUser, onLogout, notify }) {
  const [setup, setSetup] = useState(false);
  const [off, setOff] = useState({ password: "", code: "" });
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState("");
  const [err, setErr] = useState("");
  const run = async (fn, ok) => {
    setErr("");
    try { await fn(); ok && notify(ok); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="account">
      {err && <div className="alert alert-danger py-2">{err}</div>}
      <div className="card card-body mb-3">
        <h5 className="mb-0">{user.name}</h5>
        <small className="text-secondary">{user.email} · {library.length} titels op je lijsten</small>
      </div>
      <form className="card card-body mb-3" onSubmit={(e) => { e.preventDefault(); run(async () => onUser(await api.rename(name)), "Naam opgeslagen"); }}>
        <Field label="Naam" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        <button className="btn btn-dark">Opslaan</button>
      </form>
      <form className="card card-body mb-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.changePassword(pw.current, pw.next); setPw({ current: "", next: "" }); }, "Wachtwoord gewijzigd; andere apparaten zijn uitgelogd"); }}>
        <Field label="Huidig wachtwoord" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
        <Field label="Nieuw wachtwoord (min. 6 tekens)" type="password" value={pw.next} minLength={6} maxLength={128} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" required />
        <button className="btn btn-dark">Wachtwoord wijzigen</button>
      </form>
      {setup ? (
        <div className="mb-3"><TotpSetup onSkip={() => setSetup(false)} onDone={(u) => { onUser(u); setSetup(false); notify("Authenticator aan"); }} /></div>
      ) : user.totp ? (
        <form className="card card-body mb-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.totpDisable(off.password, off.code); onUser(r.user); setOff({ password: "", code: "" }); }, "Authenticator uit"); }}>
          <b className="mb-2">Authenticator staat aan</b>
          <Field label="Wachtwoord" type="password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} autoComplete="current-password" required />
          <Field label="Authenticator- of back-upcode" value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value })} autoComplete="one-time-code" required />
          <button className="btn btn-outline-danger">Authenticator uitzetten</button>
        </form>
      ) : (
        <button className="btn btn-outline-dark w-100 mb-3" onClick={() => setSetup(true)}>Authenticator-app instellen (2FA)</button>
      )}
      <button className="btn btn-outline-dark w-100 mb-3" onClick={onLogout}>Uitloggen</button>
      <form className="card card-body" onSubmit={(e) => { e.preventDefault(); if (confirm("Je account en al je lijsten worden definitief verwijderd. Doorgaan?")) run(async () => { await api.deleteAccount(del); onLogout(true); }); }}>
        <small className="text-secondary mb-2">Account verwijderen wist ook al je lijsten.</small>
        <Field label="Wachtwoord ter bevestiging" type="password" value={del} onChange={(e) => setDel(e.target.value)} autoComplete="current-password" required />
        <button className="btn btn-outline-danger">Account verwijderen</button>
      </form>
    </div>
  );
}

// Authenticator (TOTP) setup: QR code, confirm with a first code, then show one-time backup codes
export function TotpSetup({ forced, onDone, onSkip }) {
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(null);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);
  useEffect(() => { api.totpSetup().then(setInfo).catch((e) => setErr(e.message)); }, []);
  const confirm = async (e) => {
    e.preventDefault();
    setErr("");
    try { const r = await api.totpEnable(code); setBackup(r.backupCodes); setUser(r.user); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="card card-body mx-auto" style={{ maxWidth: 420 }}>
      <h5>Beveilig je account</h5>
      {err && <div className="alert alert-danger py-2">{err}</div>}
      {backup ? (
        <>
          <p className="small">Authenticator staat aan. Bewaar deze back-upcodes veilig; elke code werkt één keer als je je telefoon kwijt bent. Ze worden niet opnieuw getoond.</p>
          <pre className="backup-codes">{backup.join("\n")}</pre>
          <button className="btn btn-dark" onClick={() => onDone(user)}>Ik heb ze bewaard</button>
        </>
      ) : info ? (
        <form onSubmit={confirm}>
          <p className="small">1. Scan de QR-code met Google Authenticator (of Authy, 1Password...). Op deze telefoon: voer de sleutel handmatig in.</p>
          <img src={info.qr} alt="QR-code" width="200" height="200" className="d-block mx-auto mb-2" style={{ background: "#fff" }} />
          <p className="small mb-1">Sleutel: <code className="user-select-all">{info.secret.match(/.{1,4}/g).join(" ")}</code></p>
          <a className="small d-block mb-3" href={info.uri}>Openen in authenticator-app</a>
          <p className="small mb-1">2. Vul de 6-cijferige code in:</p>
          <input className="form-control mb-2" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          <button className="btn btn-dark w-100">Bevestigen</button>
          {!forced && <button type="button" className="btn btn-link w-100" onClick={onSkip}>Annuleren</button>}
        </form>
      ) : !err && <p>Laden…</p>}
    </div>
  );
}
