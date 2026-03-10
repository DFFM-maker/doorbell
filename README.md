# Video Citofono 🔔

Web app per videocitofono integrata con **Frigate NVR**, **Home Assistant** e camera PTZ ONVIF.
Ottimizzata per mobile, accessibile da qualsiasi browser via HTTPS.

---

## Mockup UI

```
╔══════════════════════════╗  ╔══════════════════════════╗  ╔══════════════════════════╗
║  SENTINEL          Idle  ║  ║  CONCIERGE       ● Idle  ║  ║  OPS              ONLINE ║
╠══════════════════════════╣  ╠══════════════════════════╣  ╠══════════════════════════╣
║ ┌────────────────────┐   ║  ║ ┌────────────────────┐   ║  ║  System Hardware         ║
║ │  🔴 LIVE           │   ║  ║ │  🔴 LIVE           │   ║  ║  ┌──────┐┌──────┐┌─────┐║
║ │                    │   ║  ║ │  [video compatto]  │   ║  ║  │ CPU  ││ TEMP ││ UP  │║
║ │   [live video]     │   ║  ║ └────────────────────┘   ║  ║  │  12% ││ 45°C ││2d4h │║
║ │                    │   ║  ║                           ║  ║  └──────┘└──────┘└─────┘║
║ │  H.264 · 2.1Mbps   │   ║  ║  Quick Actions            ║  ║                          ║
║ └────────────────────┘   ║  ║  ┌─────────────────────┐  ║  ║  Event Log               ║
║                           ║  ║  │ 🔕 Mute Alerts    › │  ║  ║  ● RING  Campanello...  ║
║  PTZ  [Campanello] [Vista]║  ║  │ 💡 Porch Light    › │  ║  ║  ● ACCESS Cancello ap.. ║
║ ─────────────────────────║  ║  │ 📋 Event Logs     › │  ║  ║  ● MOTION Movimento r.. ║
║ ┌──────────────────────┐  ║  ║  └─────────────────────┘  ║  ║  ● SYS   Backend avv.. ║
║ │  🔓  Apri Cancello   │  ║  ║                           ║  ║                          ║
║ └──────────────────────┘  ║  ║  ┌──────────────────────┐ ║  ║  ┌──────────────────┐   ║
║ ┌────────┐ ┌────────┐     ║  ║  │  🔓  Apri Cancello  │ ║  ║  │ ⚠ Emergency      │   ║
║ │🎤 Parla│ │📷 Cattura│   ║  ║  └──────────────────────┘ ║  ║  │   Lockdown       │   ║
║ └────────┘ └────────┘     ║  ║                           ║  ║  └──────────────────┘   ║
╠══════════════════════════╣  ╠══════════════════════════╣  ╠══════════════════════════╣
║  🛡 Sentinel  ☀ Concierge  ⌨ Ops  ║                                                  ║
╚══════════════════════════╝  ╚══════════════════════════╝  ╚══════════════════════════╝
    Vista Dark (default)          Vista Light                   Vista Ops/Tecnica
```

### Schermata di login

```
╔══════════════════════════╗
║                          ║
║       ┌──────────┐       ║
║       │    🔑    │       ║
║       └──────────┘       ║
║                          ║
║     Video Citofono       ║
║  Inserisci la chiave     ║
║    di accesso            ║
║                          ║
║  ┌──────────────────┐    ║
║  │ ••••••••••••   👁│    ║
║  └──────────────────┘    ║
║                          ║
║  ┌──────────────────┐    ║
║  │     Accedi       │    ║
║  └──────────────────┘    ║
╚══════════════════════════╝
```

---

## Funzionalità

- **Live video** — MJPEG stream dalla camera (~2.5 fps, no go2rtc richiesto)
- **Notifiche push** — alert browser al suono del campanello via SSE real-time
- **Apertura cancello** — controllo via Home Assistant con feedback visivo
- **Preset PTZ** — spostamento camera configurabile dal frontend
- **Statistiche sistema** — CPU, temperatura, uptime in tempo reale
- **Event log** — storico eventi con badge colorati per tipo
- **Autenticazione** — API Key con login screen e localStorage
- **Proxy HTTPS** — tutti gli stream passano per il backend (no mixed-content)
- **iOS compatibile** — polyfill legacy, fix Notification API, fix Safari cache

---

## Stack

| Layer | Tecnologia |
|---|---|
| Backend | FastAPI + Uvicorn (Python 3.11+) |
| Frontend | React 18 + Vite + Tailwind CSS v3 |
| Design | Geist Design System (Vercel) |
| Animazioni | framer-motion v11 |
| Icone | lucide-react |
| Streaming | MJPEG via polling Frigate `latest.jpg` |
| Real-time | Server-Sent Events (SSE) |
| PTZ | ONVIF GotoPreset |
| Integrazione | Home Assistant REST API |
| Proxy | Zoraxy (HTTPS termination) |

---

## Architettura

```
Browser (HTTPS)
      │
      │  /api/v1/frigate/mjpeg     ← MJPEG stream
      │  /api/v1/events?key=...    ← SSE real-time
      │  /api/v1/open-gate         ← POST con X-API-Key
      ▼
Zoraxy Proxy (HTTPS termination)
      ▼
FastAPI Backend :8000
      ├── APIKeyMiddleware (X-API-Key / ?key=)
      ├── MJPEG polling → Frigate latest.jpg
      ├── SSE broadcast → tutti i client
      └── ONVIF PTZ → Camera IP
      ▼
Frigate NVR (http interno)     Camera PTZ (ONVIF)
```

---

## Installazione

```bash
# 1. Clona il repository
git clone https://github.com/DFFM-maker/doorbell.git
cd doorbell

# 2. Configura il backend
cp backend/.env.example backend/.env
# Modifica backend/.env con i tuoi valori

# 3. Installa dipendenze Python
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Build frontend
cd ../frontend
npm install
npm run build

# 5. Avvia
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Configurazione `.env`

```bash
# Home Assistant
HA_URL=http://192.168.1.x:8123
HA_TOKEN=your_long_lived_token
HA_GATE_ENTITY=switch.your_gate_entity

# Frigate NVR
FRIGATE_URL=http://192.168.1.x:5000
FRIGATE_CAMERA=nome_camera

# Camera PTZ (ONVIF)
CAMERA_IP=192.168.1.x
CAMERA_USER=admin
CAMERA_PASS=password
CAMERA_PORT=80
PTZ_PRESET_RING=4      # preset al suono del campanello
PTZ_PRESET_IDLE=1      # preset dopo timeout
PTZ_PRESETS=Campanello:4,Vista 2:2,Panoramica:1

# App
APP_HOST=0.0.0.0
APP_PORT=8000
RING_TIMEOUT=120
PUBLIC_URL=https://your-domain.example.com
WEB_API_KEY=chiave_accesso_forte_e_casuale
```

---

## API

Tutte le rotte `/api/*` richiedono l'header `X-API-Key: <chiave>` oppure `?key=<chiave>`.

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/v1/ring` | POST | Trigger campanello (da Home Assistant) |
| `/api/v1/open-gate` | POST | Apri cancello via HA |
| `/api/v1/status` | GET | Stato corrente + preset PTZ |
| `/api/v1/events?key=` | GET | SSE stream real-time |
| `/api/v1/frigate/mjpeg?key=` | GET | MJPEG live stream |
| `/api/v1/frigate/snapshot` | GET | Snapshot JPEG |
| `/api/v1/frigate/stream-url` | GET | URL stream proxy |
| `/api/v1/ptz/presets` | GET | Lista preset PTZ configurati |
| `/api/v1/ptz/goto/{token}` | POST | Sposta camera a preset |
| `/api/v1/system/stats` | GET | CPU%, temperatura, uptime |

---

## Integrazione Home Assistant

Automazione per notifiche push al suono del campanello:

```yaml
alias: Citofono - Notifica al suono
triggers:
  - entity_id: input_button.test_campanello
    trigger: state
actions:
  - action: rest_command.trigger_doorbell
  - action: notify.mobile_app_iphone
    data:
      title: "🔔 Qualcuno ha suonato!"
      message: "Clicca per rispondere al citofono"
      data:
        url: https://doorbell.dffm.it
        clickAction: https://doorbell.dffm.it
        importance: high
```
