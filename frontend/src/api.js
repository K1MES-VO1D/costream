// In the APK the API lives on the phone itself (Termux backend); in the browser it is same-origin
const BASE = import.meta.env.VITE_API_URL || "";
const getToken = () => localStorage.getItem("token");

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken() && !path.startsWith("/auth/")) window.dispatchEvent(new Event("difonti-expired"));
  if (!res.ok) throw Object.assign(new Error(data.error || "Er ging iets mis"), { data });
  return data;
}

export const api = {
  services: () => request("/services"),
  titles: (q = "") => request(`/titles?q=${encodeURIComponent(q)}`),
  library: () => request("/library"),
  saveEntry: (id, patch) => request(`/library/${encodeURIComponent(id)}`, { method: "PUT", body: patch }),
  removeEntry: (id) => request(`/library/${encodeURIComponent(id)}`, { method: "DELETE" }),
  register: (b) => request("/auth/register", { method: "POST", body: b }),
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  forgot: (email) => request("/auth/forgot", { method: "POST", body: { email } }),
  reset: (b) => request("/auth/reset", { method: "POST", body: b }),
  totpSetup: () => request("/totp/setup", { method: "POST" }),
  totpEnable: (code) => request("/totp/enable", { method: "POST", body: { code } }),
  totpDisable: (password, code) => request("/totp/disable", { method: "POST", body: { password, code } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  rename: (name) => request("/me", { method: "PATCH", body: { name } }),
  changePassword: (current, next) => request("/auth/password", { method: "POST", body: { current, next } }),
  deleteAccount: (password) => request("/me", { method: "DELETE", body: { password } }),
  archiveVideo: (id) => request(`/archive/${encodeURIComponent(id)}/video`),
};
