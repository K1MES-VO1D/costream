# Difonti

Free streaming hub: public-domain and open films and series from Internet Archive, Dailymotion, Vimeo and YouTube in one mobile-first app
(swipeable tips, search, watchlist, paste-a-link adder). Paid services are not included.

The backend refreshes the catalog on start and every 6 hours from public APIs (Internet Archive search, Dailymotion API).
Optional keys for more sources: `VIMEO_TOKEN` (Vimeo API, Creative Commons filter) and `YOUTUBE_API_KEY` (YouTube Data API, CC-licensed, embeddable).
Internet Archive titles play in an HTML5 `<video>` tag when an mp4 exists, otherwise via the archive embed.

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
cd difonti/backend && npm install
node server.js
```
4. Open `http://localhost:4000` in Chrome on the phone → menu → **Add to Home screen** (note: service worker/PWA install needs HTTPS or localhost; localhost works).
5. Other devices on the same Wi-Fi can use `http://<phone-ip>:4000` (`ifconfig` in Termux).

Optional from F-Droid: **Termux:Boot** (autostart), **Termux:Widget** (home-screen start button). Run `termux-wake-lock` to keep the server alive.

## API
`POST /api/auth/register|login`, `GET /api/services`, `GET /api/titles?q=`, `GET /api/archive/:id/video`, `GET /api/watchlist`, `POST|DELETE /api/watchlist/:titleId`.

Data is in memory (resets on restart); set `JWT_SECRET` in production.
