# Video Citofono - Doorbell Project

## Stack
- Backend: FastAPI + Uvicorn (Python 3.11), porta 8000
- Frontend: React 18 + Vite + Tailwind CSS v3 + Geist Design System
- Streaming: MJPEG via Frigate NVR
- Real-time: SSE (Server-Sent Events)
- PTZ: ONVIF GotoPreset
- Integrazione: Home Assistant REST API
- Proxy HTTPS: Zoraxy
- SIP: Fanvil i10S (in sviluppo)

## Target primario
iOS Safari, viewport 390px (iPhone 14 Pro)
Accessibile via HTTPS da mobile

## Branch attivo
Branch dev: /opt/doorbell (branch: dev)
Deploy automatico su push a dev

## Regole
- Nessun console.log nel codice produzione
- Rispettare sempre Geist Design System per colori/spacing
- Safe area inset per iOS obbligatoria su elementi fixed
- git commit solo dopo /code-review senza errori critici
