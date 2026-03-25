# Release Notes — Video Citofono

---

## v3.0.0 — 2026-03-25

### SIP/Asterisk + Dockerizzazione

Integrazione audio bidirezionale tramite Asterisk, JsSIP nel browser e containerizzazione dell'infrastruttura.

---

### Nuove funzionalità

#### 1. Asterisk in Docker

- `docker-compose.yml` con servizio `asterisk` (`network_mode: host` per UDP SIP/RTP e WS)
- `asterisk/Dockerfile` — immagine custom da `asterisk:latest`
- Configurazioni: `pjsip.conf` (peer `webapp` + `citofono`), `extensions.conf` (dialplan `ring-all`), `manager.conf` (AMI), `rtp.conf`, `http.conf` (WS su porta 8088)

#### 2. Backend — AMI Originate + SIP WS Proxy

- `ami_originate_doorbell()` — al suono del campanello origina `Local/ring-all@doorbell` via Asterisk AMI TCP (porta 5038)
- Dialplan `ring-all`: suona `PJSIP/webapp` e `PJSIP/citofono` simultaneamente; se citofono non è registrato, Dial lo skippa silenziosamente
- `/api/sip/ws` — proxy WebSocket SIP verso `ws://127.0.0.1:8088/ws` (necessario per HTTPS/WSS); preserva subprotocol `sip` richiesto da JsSIP
- Config AMI: `AMI_HOST`, `AMI_PORT`, `AMI_USER`, `AMI_SECRET` in `.env`

#### 3. Frontend — SipPhone.jsx (JsSIP WebRTC)

- `SipPhone` si registra come `sip:webapp@<host>` via WebSocket proxy del backend
- Riceve chiamate in ingresso (dal citofono fisico o da Linphone in test)
- UI bottom-sheet animata con framer-motion: stati `ringing` (Rispondi / Rifiuta) e `active` (Mute / Chiudi)
- Indicatore `SIP Ready` / `SIP Error` fisso in basso a destra
- Audio remoto su elemento `<audio autoPlay playsInline>` (iOS-safe)

#### 4. Dockerfiles

- `backend/Dockerfile` — `python:3.12-slim`, uvicorn su porta 8000
- `frontend/Dockerfile` — build Vite + nginx, `nginx.conf` con SPA fallback e cache immutabile per gli asset

---

## v2.1.0 — 2026-03-10

### Fix streaming, autenticazione e iOS

Patch post-v2.0.0 che correggono regressioni critiche su MJPEG, SSE e iOS.

---

### Fix

| Issue | Causa | Fix |
|---|---|---|
| MJPEG/SSE interrotti | `BaseHTTPMiddleware` bufferizza tutto il body prima di inviare | Riscrittura `APIKeyMiddleware` come ASGI puro (scope/receive/send) |
| `422` su `/api/v1/events?key=` | `sse_events` mancava l'annotazione `Request` | Aggiunta annotazione; FastAPI non iniettava più il parametro |
| Snapshot non autenticato su iOS | URL snapshot non includeva `?key=` | Chiave aggiunta anche all'URL snapshot in `App.jsx` |
| Snapshot non mostrato su iOS | iOS Safari non supporta MJPEG multipart | `VideoCard`: rileva iOS → polling snapshot 500ms invece di MJPEG |
| Blink snapshot ogni refresh iOS | `key` prop sull'`<img>` costringeva il remount | Rimosso `key` da `<img>` in `VideoCard` |
| Ring non triggerava PTZ/SSE | `/api/v1/ring` chiamato da HA (server-to-server) richiedeva API key | Endpoint aggiunto a `_EXEMPT` in `APIKeyMiddleware` |

---

## v2.0.0 — 2026-03-10

### Geist UI Redesign + Autenticazione + Fix iOS

Riscrittura completa del frontend con il design system **Geist** (Vercel),
autenticazione API Key e numerosi fix per iOS Safari.

---

### Nuove funzionalità

#### 1. Redesign UI — Geist Design System

Interfaccia completamente ridisegnata con tre viste distinte:

| Vista | Tema | Contenuto |
|---|---|---|
| **Sentinel** | Dark (#000) | Video fullwidth, preset PTZ, gate button, control pad |
| **Concierge** | Light (#fff) | Video compatto, quick actions, gate button |
| **Ops** | Gray (#fafafa) | Statistiche sistema, event log, emergency lockdown |

- **Tailwind CSS v3** con token Geist custom
- **framer-motion v11** — slide transitions, AnimatePresence, layoutId nav pill
- **lucide-react** — iconografia
- **Inter + JetBrains Mono** via Google Fonts
- `fixed inset-0` layout universale (fallback per iOS < 15.4)

#### 2. Autenticazione API Key

- Middleware `APIKeyMiddleware` — verifica `X-API-Key` header o `?key=` query param su tutte le rotte `/api/*`
- `AuthScreen` — pagina login dark con campo password, animazione shake su errore
- Chiave salvata in `localStorage` — persiste tra sessioni
- Qualsiasi `401` riporta alla schermata di login
- `WEB_API_KEY` configurabile in `.env`

#### 3. Statistiche sistema (Ops View)

Endpoint `/api/v1/system/stats`:
- CPU% da `/proc/loadavg`
- Temperatura da `/sys/class/thermal`
- Uptime da `/proc/uptime` — formato `Xd HHh MMm`

---

### Fix iOS Safari

| Bug | Causa | Fix |
|---|---|---|
| `ReferenceError: Can't find variable: Notification` | `Notification?.x` lancia ReferenceError se la variabile non esiste | `typeof Notification !== 'undefined'` |
| React error #310 (pagina bianca) | Hook dichiarati dopo `return` condizionale | Tutti gli hook spostati prima del guard auth |
| Crash silenzioso | framer-motion v12 usa API non disponibili su vecchio iOS | Downgrade a v11 |
| Safari cache stale index.html | Vite genera nuovi filename hash ad ogni build | `Cache-Control: no-store` su index.html |
| Status bloccato su "Suona" | Frontend aspettava SSE che arrivava in ritardo | `setStatus('idle')` ottimistico al `200 OK` del gate |
| Bundle incompatibile | iOS Safari vecchio non supporta ES modules | `@vitejs/plugin-legacy` — polyfill automatici |

---

## v1.3.0 — 2026-03-10

### PTZ preset selezionabili dall'app

- **Bug fix:** rimosso movimento PTZ automatico all'apertura cancello
- `PTZ_PRESETS=Campanello:4,Vista 2:2,Panoramica:1` configurabile in `.env`
- `GET /api/v1/ptz/presets` + `POST /api/v1/ptz/goto/{token}`
- Stato preset broadcastato via SSE evento `ptz`

---

## v1.2.0 — 2026-03-10

### MJPEG stream + fix mobile

- Fix "A server error occurred." — go2rtc non configurato in Frigate
- Endpoint `/api/v1/frigate/mjpeg` — MJPEG via polling `latest.jpg` (~2.5 fps)
- Rilevamento iOS → fallback snapshot polling 400ms

---

## v1.1.0 — 2026-03-10

### Fix Mixed Content HTTPS

- Stream URL interni Frigate proxiati dal backend (no mixed-content su HTTPS)
- Proxy WebSocket bidirezionale per jsmpeg

---

## v1.0.0 — Release iniziale

- Backend FastAPI, SSE, PTZ ONVIF, Home Assistant
- Frontend React, notifiche browser, apertura cancello
