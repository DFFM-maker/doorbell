# Video Citofono 🔔

Web app per videocitofono integrata con **Frigate NVR**, **Home Assistant** e camera PTZ ONVIF.
Accessibile da qualsiasi browser, ottimizzata per mobile.

## Funzionalità

- **Live video** — MJPEG stream dalla camera (2.5 fps, senza go2rtc)
- **Foto** — snapshot aggiornato ogni 3 secondi
- **Notifica push** — alert browser quando suona il campanello (SSE real-time)
- **Apertura cancello** — controllo via Home Assistant
- **Selezione preset PTZ** — spostamento camera configurabile dal frontend
- **Proxy HTTPS** — tutti gli stream passano per il backend (no mixed-content)

## Stack

| Layer | Tecnologia |
|---|---|
| Backend | FastAPI + Uvicorn (Python) |
| Frontend | React 18 + Vite |
| Streaming | MJPEG via polling Frigate `latest.jpg` |
| Real-time | Server-Sent Events (SSE) |
| PTZ | ONVIF GotoPreset |
| Integrazione | Home Assistant REST API |

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
cd ../backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Configurazione preset PTZ

In `backend/.env`:
```
PTZ_PRESETS=Campanello:4,Vista 2:2,Panoramica:1
```
Formato: `Nome visibile:token_onvif` separati da virgola.

## Systemd service

```bash
cp doorbell.service /etc/systemd/system/
systemctl enable --now doorbell
```

## API

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/v1/ring` | POST | Trigger campanello (da HA) |
| `/api/v1/open-gate` | POST | Apri cancello via HA |
| `/api/v1/status` | GET | Stato corrente |
| `/api/v1/events` | GET | SSE stream real-time |
| `/api/v1/frigate/mjpeg` | GET | MJPEG live stream |
| `/api/v1/frigate/snapshot` | GET | Snapshot JPEG |
| `/api/v1/frigate/stream-url` | GET | URL stream proxy |
| `/api/v1/ptz/presets` | GET | Lista preset PTZ |
| `/api/v1/ptz/goto/{token}` | POST | Sposta camera a preset |
