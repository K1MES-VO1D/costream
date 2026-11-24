import { useEffect, useState } from "react";
import { api } from "./api.js";


export function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = mode === "login" ? await api.login(form) : await api.register(form);
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card-body mx-auto" style={{ maxWidth: 420 }}>
      <h4 className="mb-3">{mode === "login" ? "Inloggen" : "Account aanmaken"}</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {mode === "register" && (
        <input className="form-control mb-2" placeholder="Naam" value={form.name} onChange={set("name")} autoComplete="name" maxLength={40} required />
      )}
      <input className="form-control mb-2" type="email" placeholder="E-mail" value={form.email} onChange={set("email")} autoComplete="email" maxLength={254} required />
      <input className="form-control mb-1" type="password" placeholder={mode === "login" ? "Wachtwoord" : "Wachtwoord (min. 10 tekens)"} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 10} maxLength={128} required />
      {mode === "register" && <small className="text-secondary d-block mb-3">Kies iets unieks van minstens 10 tekens, bijvoorbeeld een zin.</small>}
      {mode === "login" && <div className="mb-3" />}
      <button className="btn btn-primary w-100" disabled={busy}>{mode === "login" ? "Inloggen" : "Registreren"}</button>
      <button type="button" className="btn btn-link mt-2" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Nog geen account? Registreer" : "Al een account? Log in"}
      </button>
    </form>
  );
}
