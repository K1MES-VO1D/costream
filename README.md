# Costream

Streaming discovery + multi-service subscription manager (Netflix, Hulu, SkyShowtime, HBO Max, Disney+, Prime Video, Videoland).
Mobile-first PWA: swipeable tips, search, watchlist, subscriptions with bundle discounts (2 services 10%, 3 → 15%, 4+ → 20%).
Service names are used for identification only; prices and titles are illustrative/fictional.

- **Backend**: Node + Express, JWT auth, in-memory data (`backend/`, port 4000)
- **Frontend**: React + Vite + Bootstrap (`frontend/`)

## Develop (PC)
```bash
cd backend && npm install && npm start
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api
```

## Run on your Android phone (Termux)
1. Install **F-Droid** from https://f-droid.org, then install **Termux** from F-Droid (the Play Store build is outdated).
2. Copy this project to the phone (e.g. `git clone` it, or copy the folder into Termux's home). Make sure `frontend/dist` exists (run `cd frontend && npm install && npm run build` on a PC first, or in Termux).
3. In Termux:
```bash
pkg update && pkg install nodejs git
cd costream/backend && npm install
JWT_SECRET=choose-a-secret node server.js
```
4. Open `http://localhost:4000` in Chrome on the phone → menu → **Add to Home screen** (note: service worker/PWA install needs HTTPS or localhost; localhost works).
5. Other devices on the same Wi-Fi can use `http://<phone-ip>:4000` (`ifconfig` in Termux).

Optional from F-Droid: **Termux:Boot** (autostart), **Termux:Widget** (home-screen start button). Run `termux-wake-lock` to keep the server alive.

## API
`POST /api/auth/register|login`, `GET /api/services`, `GET /api/titles?q=`, `GET|POST /api/subscriptions`, `DELETE /api/subscriptions/:serviceId`, `GET /api/watchlist`, `POST|DELETE /api/watchlist/:titleId`.

Data is in memory (resets on restart); set `JWT_SECRET` in production.
