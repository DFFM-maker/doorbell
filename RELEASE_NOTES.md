# Release Notes — Video Citofono

---

## v1.1.0 — 2026-03-10

### Problemi risolti

#### 1. "Server error occurred" su LIVE e FOTO — Mixed Content HTTPS

**Causa**
L'endpoint `/api/v1/frigate/stream-url` restituiva URL con IP interno di Frigate
(`http://192.168.1.9:5000/...`). Il browser, accedendo via HTTPS (`https://doorbell.dffm.it`),
bloccava queste richieste HTTP per la politica di **Mixed Content** — risultato: video nero,
foto non caricate, errore nel tab LIVE e FOTO.

**Fix**
`/api/v1/frigate/stream-url` ora restituisce URL **relativi** che passano tutti per il proxy
Zoraxy in HTTPS:

| Tipo     | Prima (bloccato)                                        | Dopo (proxy backend)                                  |
|----------|---------------------------------------------------------|-------------------------------------------------------|
| Snapshot | `http://192.168.1.9:5000/api/cancello_ptz/latest.jpg`  | `/api/v1/frigate/snapshot`                            |
| JSMpeg   | `http://192.168.1.9:5000/live/jsmpeg/cancello_ptz`     | `/api/v1/frigate/page/live/jsmpeg/cancello_ptz`       |
| WebRTC   | `http://192.168.1.9:5000/live/webrtc/cancello_ptz`     | `/api/v1/frigate/page/live/webrtc/cancello_ptz`       |

---

#### 2. Video nero — WebSocket jsmpeg non instradato

**Causa**
Il player jsmpeg di Frigate apre una connessione WebSocket a `ws://[frigate-ip]/live/...`.
Con il browser su HTTPS, questo collegamento WS (non sicuro) veniva bloccato.

**Fix**
Aggiunti due nuovi componenti nel backend:

- **`GET /api/v1/frigate/page/{path}`** — Proxy HTTP che recupera le pagine Frigate
  (jsmpeg/webrtc) e riscrive i tag WebSocket interni sostituendo l'IP di Frigate con
  il path del proxy locale (`/api/v1/frigate/ws/...`).

- **`WebSocket /api/v1/frigate/ws/{path}`** — Proxy WebSocket bidirezionale: riceve la
  connessione WSS dal browser e la inoltra come WS non sicuro verso Frigate internamente.

Dipendenza aggiunta: `websockets>=12.0` (installata nel venv).

---

#### 3. Log errori insufficienti

**Causa**
Il backend non stampava dettagli sugli errori durante il caricamento del video, rendendo
difficile il debug.

**Fix**
Aggiunti log strutturati `[snapshot]`, `[page-proxy]`, `[ws-proxy]` con:
- URL preciso della richiesta a Frigate
- Tipo di errore (`HTTPStatusError`, `RequestError`, eccetera)
- Codice HTTP e numero di byte in caso di successo

Esempio log in caso di errore:
```
ERROR:main:[snapshot] ERRORE connessione a Frigate (http://192.168.1.9:5000/...): ConnectError: ...
ERROR:main:[page-proxy] ERRORE HTTP 404 da Frigate (...): ...
ERROR:main:[ws-proxy] ERRORE (ws://192.168.1.9:5000/live/...): ConnectionRefusedError: ...
```

---

#### 4. Frontend — Nessun feedback visivo sugli errori stream

**Causa**
Il componente `VideoPlayer` non mostrava nulla in caso di errore iframe/immagine, lasciando
l'utente davanti a uno schermo nero senza indicazioni.

**Fix**
- Aggiunto `onError` agli iframe WebRTC e JSMpeg con `console.error` dettagliato
- Aggiunto `onError` all'immagine snapshot con `console.error`
- Mostrato messaggio "⚠️ Stream non disponibile / Foto non disponibile" con
  indicazione di controllare i log del backend
- Il tab WebRTC, in caso di errore, esegue automaticamente il fallback a JSMpeg

---

### Architettura flusso dati (dopo il fix)

```
Browser (HTTPS)
      │
      │  /api/v1/frigate/snapshot        (GET  → immagine JPEG)
      │  /api/v1/frigate/page/live/...   (GET  → HTML Frigate, WS URL riscritti)
      │  /api/v1/frigate/ws/live/...     (WSS  → WS proxy verso Frigate)
      ▼
Zoraxy Proxy (192.168.1.246)  →  HTTPS termination
      │
      ▼
FastAPI Backend (192.168.1.6:8000)
      │
      │  http://192.168.1.9:5000/...     (HTTP interno)
      │  ws://192.168.1.9:5000/...       (WS interno)
      ▼
Frigate NVR (192.168.1.9:5000)
```

### File modificati

| File | Modifica |
|------|----------|
| `backend/main.py` | Nuovi endpoint proxy snapshot, page, WebSocket; URL relativi in `stream-url`; import `Request`, `Response`, `WebSocket`, `re` |
| `backend/requirements.txt` | Aggiunto `websockets>=12.0` |
| `frontend/src/components/VideoPlayer.jsx` | Error handling `onError`, stati `snapError`/`iframeError`, fallback WebRTC→JSMpeg |
| `frontend/src/components/VideoPlayer.css` | Stile `.vp-error` per messaggi di errore |

---

## v1.3.0 — 2026-03-10

### Problemi risolti

#### 1. Bug — PTZ si sposta su preset 1 all'apertura del cancello

**Causa**
`open-gate` chiamava `async_move_to_preset(PTZ_PRESET_IDLE)` immediatamente dopo aver
aperto il cancello, spostando la camera prima che l'utente potesse vedere chi passa.

**Fix**
Rimosso il movimento PTZ automatico da `open-gate`. La camera resta sul preset corrente
fino a quando l'utente la sposta manualmente o scatta il timeout di ring.
Il timeout di ring (`schedule_reset`) continua a riportare la camera al preset idle.

#### 2. Nuova funzionalità — Selezione preset PTZ dall'app

**Configurazione in `.env`**
```
PTZ_PRESETS=Campanello:4,Vista 2:2,Panoramica:1
```
Formato: `Nome visibile:token_onvif`, separati da virgola.

**Nuovi endpoint backend**

| Endpoint | Descrizione |
|---|---|
| `GET /api/v1/ptz/presets` | Lista preset configurati + preset corrente |
| `POST /api/v1/ptz/goto/{token}` | Sposta la camera al preset (token validato) |

**Stato corrente**
- `AppState.current_preset` traccia il token del preset attivo
- Broadcastato via SSE con evento `ptz` a tutti i client connessi
- Incluso nella risposta di `/api/v1/status`
- Inviato ai nuovi client SSE subito alla connessione

**UI — componente `PtzSelector`**
- Riga di bottoni pill sotto il video (uno per preset configurato)
- Bottone attivo evidenziato in verde
- Spinner animato durante il movimento (2 secondi)
- Aggiornamento in tempo reale via SSE (se un altro client sposta la camera)

### File modificati

| File | Modifica |
|---|---|
| `backend/.env` | Aggiunto `PTZ_PRESETS` |
| `backend/main.py` | Parsing preset, `AppState.current_preset`, endpoint PTZ, fix gate |
| `frontend/src/App.jsx` | Import/render `PtzSelector`, stato `currentPreset`, listener SSE `ptz` |
| `frontend/src/components/PtzSelector.jsx` | Nuovo componente |
| `frontend/src/components/PtzSelector.css` | Stile pill buttons con stato attivo/movimento |

---

## v1.2.0 — 2026-03-10

### Problemi risolti

#### 1. "A server error occurred." su LIVE — go2rtc non configurato

**Causa**
Frigate restituisce **HTTP 500** su `/live/jsmpeg/{camera}` e `/live/webrtc/{camera}` perché
go2rtc non ha stream configurati (`{}`). Questi endpoint non sono utilizzabili.

**Fix**
- Rimossi i tab **WebRTC** e **Live (jsmpeg)** che usavano iframe verso Frigate
- Aggiunto endpoint backend `/api/v1/frigate/mjpeg` che costruisce un **MJPEG stream**
  tramite polling ripetuto di `latest.jpg` (~2.5 fps) — nessuna dipendenza da go2rtc
- Il tab **LIVE** ora usa `<img src="/api/v1/frigate/mjpeg">` nativo del browser
  - **Android / Chrome / Firefox**: MJPEG nativo diretto
  - **iOS / Safari**: rilevamento automatico → fallback a fast-snapshot (400ms)

#### 2. Mobile — Layout e usabilità migliorati

**Fix CSS e layout**:
- `viewport-fit=cover` in `index.html` per supporto iPhone notch e home bar
- `min-height: 100dvh` (dynamic viewport height) che esclude la chrome del browser
- `padding-bottom: env(safe-area-inset-bottom)` per evitare sovrapposizione col tasto home
- `video-section` usa `clamp(200px, 38vh, 360px)` invece di aspect-ratio fisso
- `touch-action: manipulation` su tutti i bottoni (elimina il delay 300ms su mobile)
- Header con `backdrop-filter: blur` per look moderno su scroll
- Tab del player riprogettati con pill arrotondate e area tap maggiorata

### File modificati

| File | Modifica |
|------|----------|
| `backend/main.py` | Nuovo endpoint MJPEG; `stream-url` restituisce solo `mjpeg` e `snapshot` |
| `frontend/index.html` | `viewport-fit=cover` |
| `frontend/src/components/VideoPlayer.jsx` | Rimossi iframe jsmpeg/webrtc; MJPEG + polling iOS |
| `frontend/src/components/VideoPlayer.css` | Redesign completo, spinner CSS, errori, badge suona |
| `frontend/src/App.css` | `100dvh`, safe-area-inset, video height clamp, media queries |
| `frontend/src/components/GateButton.css` | `touch-action: manipulation`, padding aumentato |

---

## v1.0.0 — Release iniziale

- Backend FastAPI con SSE, PTZ ONVIF, integrazione Home Assistant
- Frontend React con player WebRTC/JSMpeg/Snapshot
- Supporto notifiche browser al suono del campanello
- Controllo apertura cancello via Home Assistant
