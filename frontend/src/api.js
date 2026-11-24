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
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  services: () => request("/services"),
  titles: (q = "") => request(`/titles?q=${encodeURIComponent(q)}`),
  watchlist: () => request("/watchlist"),
  addWatch: (id) => request(`/watchlist/${id}`, { method: "POST" }),
  removeWatch: (id) => request(`/watchlist/${id}`, { method: "DELETE" }),
  register: (b) => request("/auth/register", { method: "POST", body: b }),
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  archiveVideo: (id) => request(`/archive/${encodeURIComponent(id)}/video`),
};
