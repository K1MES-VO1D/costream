import { useEffect, useState } from "react";
import { api } from "./api.js";

const fmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
export const money = (n) => fmt.format(n);
export const emptySummary = { items: [], subtotal: 0, discountRate: 0, discount: 0, total: 0 };

export function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = mode === "login" ? await api.login(form) : await api.register(form);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="card card-body mx-auto" style={{ maxWidth: 420 }}>
      <h4 className="mb-3">{mode === "login" ? "Inloggen" : "Account aanmaken"}</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {mode === "register" && (
        <input className="form-control mb-2" placeholder="Naam" value={form.name} onChange={set("name")} required />
      )}
      <input className="form-control mb-2" type="email" placeholder="E-mail" value={form.email} onChange={set("email")} required />
      <input className="form-control mb-3" type="password" placeholder="Wachtwoord (min. 6 tekens)" value={form.password} onChange={set("password")} required />
      <button className="btn btn-primary w-100">{mode === "login" ? "Inloggen" : "Registreren"}</button>
      <button type="button" className="btn btn-link mt-2" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Nog geen account? Registreer" : "Al een account? Log in"}
      </button>
    </form>
  );
}

export function ServiceCard({ service, current, user, onLogin, onSubscribe, onCancel }) {
  const [planId, setPlanId] = useState(current?.plan.id ?? service.plans[0].id);
  const changed = current && current.plan.id !== planId;

  return (
    <div className="card service-card h-100" style={{ "--accent": service.color }}>
      <div className="service-banner" style={{ background: service.color }} />
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start">
          <h5 className="card-title">{service.name}</h5>
          <span className="badge text-bg-secondary">{service.category}</span>
        </div>
        <p className="text-secondary small">{service.description}</p>
        <div className="d-grid gap-2 mb-3">
          {service.plans.map((p) => (
            <div key={p.id} className={`plan-option d-flex justify-content-between ${planId === p.id ? "active" : ""}`} onClick={() => setPlanId(p.id)}>
              <span>
                <strong>{p.name}</strong>
                <small className="d-block text-secondary">{p.quality} · {p.screens} screen{p.screens > 1 && "s"}</small>
              </span>
              <span className="fw-semibold">{money(p.price)}/mnd</span>
            </div>
          ))}
        </div>
        <div className="mt-auto d-flex gap-2">
          <button className="btn btn-primary flex-grow-1" disabled={user && current && !changed} onClick={() => (user ? onSubscribe(service.id, planId) : onLogin())}>
            {!user ? "Log in om te abonneren" : !current ? "Abonneren" : changed ? "Pakket wijzigen" : "Geabonneerd"}
          </button>
          {current && <button className="btn btn-outline-danger" onClick={() => onCancel(service.id)}>Opzeggen</button>}
        </div>
      </div>
    </div>
  );
}

