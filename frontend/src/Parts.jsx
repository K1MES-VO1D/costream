import { useEffect, useState } from "react";
import { api } from "./api.js";


export function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needTotp, setNeedTotp] = useState(false);
  const [sent, setSent] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const title = { login: "Inloggen", register: "Account aanmaken", reset: "Wachtwoord vergeten" }[mode];
  const action = { login: api.login, register: api.register, reset: api.reset }[mode];

  const sendCode = async () => {
    setError("");
    if (!form.email) return setError("Vul eerst je e-mailadres in");
    try { setSent(await api.forgot(form.email)); } catch (err) { setError(err.message); }
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuth(await action(form));
    } catch (err) {
      if (err.data?.needTotp) setNeedTotp(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card-body mx-auto" style={{ maxWidth: 420 }}>
      <h4 className="mb-3">{title}</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {mode === "register" && (
        <input className="form-control mb-2" placeholder="Naam" value={form.name} onChange={set("name")} autoComplete="name" maxLength={40} required />
      )}
      <input className="form-control mb-2" type="email" placeholder="E-mail" value={form.email} onChange={set("email")} autoComplete="email" maxLength={254} required />
      {mode === "reset" && (
        <>
          <button type="button" className="btn btn-outline-light mb-2" onClick={sendCode}>{sent ? "Code opnieuw sturen" : "Stuur code naar mijn e-mail"}</button>
          {sent && <small className="text-secondary d-block mb-2">{sent.mail ? "Als dit adres bij een account hoort, is er een code gemaild. Geldig 15 minuten." : "Er is nog geen mailserver ingesteld; de code staat in Termux (zie README)."}</small>}
          <input className="form-control mb-2" placeholder="Code uit je e-mail (of authenticator)" value={form.code} onChange={set("code")} autoCapitalize="characters" autoComplete="one-time-code" maxLength={20} required />
        </>
      )}
      {mode === "login" && needTotp && (
        <input className="form-control mb-2" placeholder="Authenticator-code (6 cijfers)" value={form.code} onChange={set("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={20} autoFocus required />
      )}
      <input className="form-control mb-1" type="password" placeholder={mode === "login" ? "Wachtwoord" : "Nieuw wachtwoord (min. 6 tekens)"} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 6} maxLength={128} required />
      <div className="mb-3" />
      <button className="btn btn-primary w-100" disabled={busy}>{{ login: "Inloggen", register: "Registreren", reset: "Wachtwoord opnieuw instellen" }[mode]}</button>
      {mode !== "reset" && (
        <button type="button" className="btn btn-link mt-2" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Nog geen account? Registreer" : "Al een account? Log in"}
        </button>
      )}
      <button type="button" className="btn btn-link" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>
        {mode === "reset" ? "Terug naar inloggen" : mode === "login" ? "Wachtwoord vergeten?" : ""}
      </button>
    </form>
  );
}
