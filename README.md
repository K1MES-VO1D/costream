# Difonti

Free streaming hub: public-domain and open films and series from Internet Archive, Dailymotion, Vimeo and YouTube in one mobile-first app
(swipeable tips, search, watchlist, paste-a-link adder). Paid services are not included.

The backend refreshes the catalog on start and every 6 hours from public APIs (Internet Archive search, Dailymotion API).
Optional key for more sources: `VIMEO_TOKEN` (Vimeo API, Creative Commons filter). YouTube wordt alleen ingesloten (geen API); voeg titels toe met `node backend/add-title.js <link>`.
Internet Archive titles play in an HTML5 `<video>` tag when an mp4 exists, otherwise via the archive embed.

- **Backend**: Node + Express, accounts and lists stored in `backend/data/db.json` (`backend/`, port 4000)
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
`POST /api/auth/register|login|logout|password`, `GET|PATCH|DELETE /api/me`, `GET /api/services`, `GET /api/titles?q=`, `GET /api/archive/:id/video`, `GET /api/library`, `PUT|DELETE /api/library/:titleId`.

Accounts and lists persist in `backend/data/db.json` (owner-only, git-ignored; set `DATA_DIR` to move it, and mount it as a volume in Docker).

**Security**: scrypt password hashing with per-user salt, 6+ character passwords, random revocable session tokens (only SHA-256 hashes stored, 30 days, max 10 per account), constant-time login with account lockout (5 failures → 15 min) and per-IP rate limits, helmet headers with a strict CSP, a locked-down CORS list (`ALLOWED_ORIGINS` for extras), 10 KB body limit, and password re-entry to delete an account. Serve over HTTPS if you expose it beyond your own phone.

**Lists**: per title a status (Kijk ik / Wil ik kijken / Gezien / Pauze / Gestopt), a 1–10 score and a note; the Lists tab shows stats, tabs and sorting.

**Authenticator (TOTP, Google Authenticator etc.)**: new accounts must set it up right after registering (QR code + 8 one-time backup codes). Once on, logging in needs the 6-digit code. Secrets are AES-256-GCM encrypted, codes can't be replayed. Forgot your password? Use an authenticator/backup code in the app, or run `node ~/difonti/backend/reset-code.js <email>` in Termux (`--list` shows accounts). Stored passwords are one-way hashes and cannot be read back.

## Wachtwoord vergeten per e-mail
Zet in `backend/.env` (zie `.env.example`) `SMTP_URL` en `MAIL_FROM` van een SMTP-provider (Gmail app-wachtwoord, Brevo, ...). Een eigen mailserver op een telefoon komt niet aan (poort 25 geblokkeerd, spamfilters), daarom gebruikt Difonti SMTP. Zonder `SMTP_URL` verschijnt de mail in de serverlog en `data/outbox.log`.
