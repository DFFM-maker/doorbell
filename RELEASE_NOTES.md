# Release Notes — Video Citofono

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
