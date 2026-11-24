import { useEffect, useState } from "react";
import { api } from "./api.js";


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
