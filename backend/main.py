import asyncio
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from starlette.types import ASGIApp, Receive, Scope, Send
from sse_starlette.sse import EventSourceResponse

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Config ---
HA_URL      = os.getenv("HA_URL", "http://192.168.1.1:8123")
HA_TOKEN = os.getenv("HA_TOKEN", "")
HA_GATE_ENTITY = os.getenv("HA_GATE_ENTITY", "switch.sonoff_1000663833_1")
FRIGATE_URL = os.getenv("FRIGATE_URL", "http://192.168.1.9:5000")
FRIGATE_CAMERA = os.getenv("FRIGATE_CAMERA", "cancello_ptz")

# Derive host:port from FRIGATE_URL for WebSocket proxying
_m = re.match(r'https?://([^/]+)', FRIGATE_URL)
FRIGATE_HOST = _m.group(1) if _m else "192.168.1.9:5000"
FRIGATE_WS_BASE = FRIGATE_URL.replace("http://", "ws://").replace("https://", "wss://")
CAMERA_IP = os.getenv("CAMERA_IP", "192.168.1.111")
CAMERA_USER = os.getenv("CAMERA_USER", "admin")
CAMERA_PASS = os.getenv("CAMERA_PASS", "")
CAMERA_PORT = int(os.getenv("CAMERA_PORT", "80"))
WEB_API_KEY      = os.getenv("WEB_API_KEY", "")
PTZ_PRESET_RING  = os.getenv("PTZ_PRESET_RING", "4")
PTZ_PRESET_IDLE  = os.getenv("PTZ_PRESET_IDLE", "1")
RING_TIMEOUT     = int(os.getenv("RING_TIMEOUT", "120"))

# Asterisk AMI
AMI_HOST   = os.getenv("AMI_HOST", "127.0.0.1")
AMI_PORT   = int(os.getenv("AMI_PORT", "5038"))
AMI_USER   = os.getenv("AMI_USER", "admin")
AMI_SECRET = os.getenv("AMI_SECRET", "asterisk_ami")

# Preset selezionabili dall'app — formato "Nome:token,Nome:token"
def _parse_presets(raw: str) -> list[dict]:
    result = []
    for item in raw.split(","):
        item = item.strip()
        if ":" in item:
            name, token = item.rsplit(":", 1)
            result.append({"name": name.strip(), "token": token.strip()})
    return result

_presets_raw = os.getenv("PTZ_PRESETS", f"Campanello:{PTZ_PRESET_RING},Panoramica:{PTZ_PRESET_IDLE}")
PTZ_PRESETS: list[dict] = _parse_presets(_presets_raw)
logger.info(f"PTZ preset configurati: {PTZ_PRESETS}")

# --- State ---
class AppState:
    status: str = "idle"          # idle | ringing | active
    ring_time: datetime | None = None
    current_preset: str = ""      # token del preset PTZ corrente
    sse_clients: list[asyncio.Queue] = []

    def broadcast(self, event: str, data: str):
        dead = []
        for q in self.sse_clients:
            try:
                q.put_nowait({"event": event, "data": data})
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.sse_clients.remove(q)

state = AppState()
reset_task: asyncio.Task | None = None


# --- PTZ helpers ---
def move_to_preset(preset_token: str):
    """Send ONVIF GotoPreset command to the PTZ camera."""
    try:
        from onvif import ONVIFCamera
        cam = ONVIFCamera(CAMERA_IP, CAMERA_PORT, CAMERA_USER, CAMERA_PASS)
        ptz = cam.create_ptz_service()
        media = cam.create_media_service()
        profiles = media.GetProfiles()
        profile_token = profiles[0].token
        ptz.GotoPreset({
            "ProfileToken": profile_token,
            "PresetToken": preset_token,
            "Speed": {},
        })
        logger.info(f"PTZ moved to preset {preset_token}")
    except Exception as e:
        logger.error(f"PTZ error: {e}")


async def async_move_to_preset(preset_token: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, move_to_preset, preset_token)
    state.current_preset = preset_token
    state.broadcast("ptz", preset_token)


# --- Asterisk AMI helpers ---
async def ami_originate_doorbell():
    """
    Origina una chiamata SIP tramite Asterisk AMI:
    'citofono' chiama 'webapp' — simula il flusso fisico del DH-SB-86.
    """
    action_id = "doorbell-ring"
    login_action = (
        "Action: Login\r\n"
        f"Username: {AMI_USER}\r\n"
        f"Secret: {AMI_SECRET}\r\n"
        f"ActionID: login-{action_id}\r\n"
        "\r\n"
    )
    originate_action = (
        "Action: Originate\r\n"
        f"ActionID: {action_id}\r\n"
        # Local channel: una metà esegue ring-all (Dial webapp+citofono),
        # l'altra risponde con Echo. Chi risponde (browser o Linphone)
        # si trova a parlare con l'altra metà del Local channel.
        # Funziona anche se citofono (Linphone) non è registrato:
        # Dial skippa silenziosamente i peer offline e suona solo webapp.
        "Channel: Local/ring-all@doorbell\r\n"
        "Application: Echo\r\n"
        "CallerID: Citofono <citofono>\r\n"
        "Timeout: 30000\r\n"
        "Async: true\r\n"
        "\r\n"
    )
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(AMI_HOST, AMI_PORT), timeout=5
        )
        # Leggi banner
        await asyncio.wait_for(reader.readline(), timeout=5)
        # Login
        writer.write(login_action.encode())
        await writer.drain()
        await asyncio.sleep(0.3)
        # Originate
        writer.write(originate_action.encode())
        await writer.drain()
        await asyncio.sleep(0.5)
        writer.close()
        await writer.wait_closed()
        logger.info("[AMI] Originate inviato: citofono -> webapp")
    except Exception as e:
        logger.warning(f"[AMI] Impossibile originare chiamata (Asterisk up?): {e}")


# --- Reset timer ---
async def schedule_reset():
    global reset_task
    await asyncio.sleep(RING_TIMEOUT)
    logger.info("Ring timeout: resetting to idle and moving PTZ to preset 0")
    state.status = "idle"
    state.ring_time = None
    state.broadcast("status", "idle")
    await async_move_to_preset(PTZ_PRESET_IDLE)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Video-Citofono backend started")
    yield
    logger.info("Video-Citofono backend shutting down")


app = FastAPI(title="Video-Citofono", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class APIKeyMiddleware:
    """Middleware ASGI puro — non bufferizza StreamingResponse (fix MJPEG/SSE)."""
    def __init__(self, app: ASGIApp):
        self.app = app

    # Endpoint chiamati da server (HA) — non richiedono web API key
    _EXEMPT = {"/api/v1/ring"}

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api/") and path not in self._EXEMPT:
                # Chiave via header X-API-Key
                headers = {k.lower(): v for k, v in scope.get("headers", [])}
                api_key = headers.get(b"x-api-key", b"").decode()

                # Fallback: chiave via query param ?key= (EventSource, MJPEG img)
                if not api_key:
                    qs = scope.get("query_string", b"").decode()
                    for part in qs.split("&"):
                        if part.startswith("key="):
                            api_key = part[4:]
                            break

                if not WEB_API_KEY or api_key != WEB_API_KEY:
                    resp = JSONResponse({"detail": "Unauthorized"}, status_code=401)
                    await resp(scope, receive, send)
                    return

        await self.app(scope, receive, send)


app.add_middleware(APIKeyMiddleware)


# --- API Routes ---

@app.post("/api/v1/ring")
async def ring():
    """Called by Home Assistant when doorbell is pressed."""
    global reset_task

    logger.info("Ring received!")

    # Cancel existing reset timer if any
    if reset_task and not reset_task.done():
        reset_task.cancel()

    state.status = "ringing"
    state.ring_time = datetime.now()

    asyncio.create_task(async_move_to_preset(PTZ_PRESET_RING))

    # Notify all SSE clients
    state.broadcast("status", "ringing")

    # Schedule auto-reset
    reset_task = asyncio.create_task(schedule_reset())

    # La webapp chiama citofono autonomamente via SSE ring event (callCitofono in SipPhone.jsx)
    # AMI originate rimosso: eliminava race condition iOS (webapp non ancora registrata)

    return {"status": "ok", "message": "Ring processed"}


@app.post("/api/v1/open-gate")
async def open_gate():
    """Open the gate via Home Assistant."""
    headers = {
        "Authorization": f"Bearer {HA_TOKEN}",
        "Content-Type": "application/json",
    }

    entity_domain = HA_GATE_ENTITY.split(".")[0]

    # Determine service based on entity type
    if entity_domain == "button":
        service = "button/press"
        payload = {"entity_id": HA_GATE_ENTITY}
    elif entity_domain == "script":
        service = f"script/{HA_GATE_ENTITY.split('.')[1]}"
        payload = {}
    else:
        # switch or input_boolean
        service = "switch/turn_on"
        payload = {"entity_id": HA_GATE_ENTITY}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{HA_URL}/api/services/{service}",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
        logger.info(f"Gate opened via HA: {resp.status_code}")

        # Cancel the ring reset timer (we handle reset here)
        if reset_task and not reset_task.done():
            reset_task.cancel()

        # Reset stato — NON sposta il PTZ automaticamente: l'utente lo controlla manualmente
        state.status = "idle"
        state.ring_time = None
        state.broadcast("status", "idle")

        # Auto turn off switch after 2s if it's a switch
        if entity_domain == "switch":
            async def delayed_off():
                await asyncio.sleep(2)
                async with httpx.AsyncClient(timeout=10) as c:
                    await c.post(
                        f"{HA_URL}/api/services/switch/turn_off",
                        headers=headers,
                        json={"entity_id": HA_GATE_ENTITY},
                    )
            asyncio.create_task(delayed_off())

        return {"status": "ok", "message": "Gate command sent"}
    except httpx.HTTPError as e:
        logger.error(f"HA error: {e}")
        raise HTTPException(status_code=502, detail=f"Home Assistant error: {str(e)}")


@app.get("/api/v1/status")
async def get_status():
    return {
        "status": state.status,
        "ring_time": state.ring_time.isoformat() if state.ring_time else None,
        "current_preset": state.current_preset,
        "frigate_url": FRIGATE_URL,
        "frigate_camera": FRIGATE_CAMERA,
    }


@app.get("/api/v1/ptz/presets")
async def ptz_list_presets():
    """Restituisce i preset PTZ configurati e il preset corrente."""
    return {
        "presets": PTZ_PRESETS,
        "current": state.current_preset,
    }


@app.post("/api/v1/ptz/goto/{token}")
async def ptz_goto(token: str):
    """Sposta il PTZ al preset indicato dal token."""
    # Verifica che il token esista tra i preset configurati
    valid_tokens = {p["token"] for p in PTZ_PRESETS}
    if token not in valid_tokens:
        raise HTTPException(status_code=400, detail=f"Preset token '{token}' non configurato")
    logger.info(f"[ptz] Movimento manuale → preset {token}")
    asyncio.create_task(async_move_to_preset(token))
    return {"status": "ok", "token": token}


@app.get("/api/v1/events")
async def sse_events(request: Request) -> EventSourceResponse:
    """Server-Sent Events stream for real-time status updates."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=10)
    state.sse_clients.append(queue)

    async def event_generator() -> AsyncGenerator:
        # Invia stato corrente subito alla connessione
        yield {"event": "status", "data": state.status}
        if state.current_preset:
            yield {"event": "ptz", "data": state.current_preset}
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield msg
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield {"event": "ping", "data": "ping"}
        finally:
            if queue in state.sse_clients:
                state.sse_clients.remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/api/v1/system/stats")
async def system_stats():
    """Statistiche sistema per la Ops view (CPU, temperatura, uptime)."""
    # CPU load (1 min avg → percentuale approssimativa)
    cpu_pct = 0
    try:
        with open("/proc/loadavg") as f:
            load1 = float(f.read().split()[0])
        with open("/proc/cpuinfo") as f:
            cpus = f.read().count("processor\t:")
        cpu_pct = min(round((load1 / max(cpus, 1)) * 100), 100)
    except Exception:
        pass

    # Temperatura (prova percorsi comuni)
    temp_c = None
    for path in ["/sys/class/thermal/thermal_zone0/temp",
                 "/sys/class/hwmon/hwmon0/temp1_input"]:
        try:
            with open(path) as f:
                temp_c = int(f.read().strip()) // 1000
            break
        except Exception:
            pass

    # Uptime
    uptime_str = "N/A"
    try:
        with open("/proc/uptime") as f:
            secs = int(float(f.read().split()[0]))
        d, rem = divmod(secs, 86400)
        h, m   = divmod(rem, 3600)
        uptime_str = f"{d}d {h:02d}h {m//60:02d}m"
    except Exception:
        pass

    return {"cpu_pct": cpu_pct, "temp_c": temp_c, "uptime": uptime_str}


@app.get("/api/v1/frigate/stream-url")
async def frigate_stream_url():
    """Return Frigate stream URLs via backend proxy (avoids mixed-content HTTPS block)."""
    return {
        "mjpeg":    "/api/v1/frigate/mjpeg",
        "snapshot": "/api/v1/frigate/snapshot",
    }


@app.get("/api/v1/frigate/mjpeg")
async def frigate_mjpeg(request: Request):
    """MJPEG stream via polling snapshot — funziona senza go2rtc, compatibile HTTPS."""
    boundary = "mjpegframe"
    url = f"{FRIGATE_URL}/api/{FRIGATE_CAMERA}/latest.jpg"
    logger.info(f"[mjpeg] Nuovo client: {request.client}")

    async def generate():
        frame_count = 0
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                while True:
                    if await request.is_disconnected():
                        logger.info(f"[mjpeg] Client disconnesso dopo {frame_count} frame")
                        break
                    try:
                        resp = await client.get(url)
                        if resp.status_code == 200:
                            data = resp.content
                            frame_count += 1
                            yield (
                                f"--{boundary}\r\n"
                                f"Content-Type: image/jpeg\r\n"
                                f"Content-Length: {len(data)}\r\n\r\n"
                            ).encode() + data + b"\r\n"
                        else:
                            logger.warning(f"[mjpeg] Frigate risposta {resp.status_code} al frame #{frame_count}")
                    except Exception as e:
                        logger.error(f"[mjpeg] Errore frame #{frame_count}: {type(e).__name__}: {e}")
                    await asyncio.sleep(0.4)  # ~2.5 fps
        except Exception as e:
            logger.error(f"[mjpeg] Stream interrotto: {type(e).__name__}: {e}")
        finally:
            logger.info(f"[mjpeg] Stream chiuso — {frame_count} frame inviati")

    return StreamingResponse(
        generate(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers={"Cache-Control": "no-cache, no-store"},
    )


@app.get("/api/v1/frigate/snapshot")
async def proxy_frigate_snapshot():
    """Proxy Frigate latest snapshot image — evita mixed-content su HTTPS."""
    url = f"{FRIGATE_URL}/api/{FRIGATE_CAMERA}/latest.jpg"
    logger.info(f"[snapshot] Richiesta proxy da Frigate: {url}")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        logger.info(f"[snapshot] OK {resp.status_code} — {len(resp.content)} bytes")
        return Response(
            content=resp.content,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )
    except httpx.HTTPStatusError as e:
        logger.error(
            f"[snapshot] ERRORE HTTP {e.response.status_code} da Frigate ({url}): {e}"
        )
        raise HTTPException(status_code=502, detail=f"Frigate ha restituito {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(
            f"[snapshot] ERRORE connessione a Frigate ({url}): {type(e).__name__}: {e}"
        )
        raise HTTPException(status_code=502, detail=f"Impossibile raggiungere Frigate: {e}")
    except Exception as e:
        logger.error(f"[snapshot] ERRORE inatteso ({url}): {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/frigate/page/{path:path}")
async def proxy_frigate_page(path: str, request: Request):
    """Proxy pagine Frigate (jsmpeg/webrtc) riscrivendo gli URL WebSocket interni."""
    url = f"{FRIGATE_URL}/{path}"
    query = str(request.url.query)
    if query:
        url += f"?{query}"
    logger.info(f"[page-proxy] Richiesta: {url}")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
        content_type = resp.headers.get("content-type", "application/octet-stream")

        if "text/html" in content_type:
            # Riscrittura URL WebSocket interni → WebSocket proxy del backend
            html = resp.text
            html = html.replace(
                f"ws://{FRIGATE_HOST}/live/",
                "/api/v1/frigate/ws/live/",
            )
            html = html.replace(
                f"wss://{FRIGATE_HOST}/live/",
                "/api/v1/frigate/ws/live/",
            )
            logger.info(f"[page-proxy] HTML proxiato OK ({len(html)} chars)")
            return Response(content=html.encode("utf-8"), media_type="text/html; charset=utf-8")

        logger.info(f"[page-proxy] Asset proxiato OK — {content_type}, {len(resp.content)} bytes")
        return Response(content=resp.content, media_type=content_type)
    except httpx.HTTPStatusError as e:
        logger.error(
            f"[page-proxy] ERRORE HTTP {e.response.status_code} da Frigate ({url}): {e}"
        )
        raise HTTPException(status_code=502, detail=f"Frigate ha restituito {e.response.status_code}")
    except httpx.RequestError as e:
        logger.error(
            f"[page-proxy] ERRORE connessione a Frigate ({url}): {type(e).__name__}: {e}"
        )
        raise HTTPException(status_code=502, detail=f"Impossibile raggiungere Frigate: {e}")
    except Exception as e:
        logger.error(f"[page-proxy] ERRORE inatteso ({url}): {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/api/v1/frigate/ws/{path:path}")
async def proxy_frigate_ws(websocket: WebSocket, path: str):
    """Proxy WebSocket Frigate jsmpeg → client browser (necessario per HTTPS/WSS)."""
    await websocket.accept()
    target_url = f"{FRIGATE_WS_BASE}/{path}"
    logger.info(f"[ws-proxy] Connessione: {websocket.client} → {target_url}")
    try:
        import websockets as ws_lib  # installato in requirements.txt
        async with ws_lib.connect(target_url) as frigate_ws:
            async def from_frigate():
                async for msg in frigate_ws:
                    if isinstance(msg, bytes):
                        await websocket.send_bytes(msg)
                    else:
                        await websocket.send_text(msg)

            async def to_frigate():
                try:
                    async for msg in websocket.iter_bytes():
                        await frigate_ws.send(msg)
                except Exception:
                    pass

            tasks = [
                asyncio.ensure_future(from_frigate()),
                asyncio.ensure_future(to_frigate()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            logger.info(f"[ws-proxy] Sessione terminata: {target_url}")
    except ImportError:
        logger.error("[ws-proxy] Libreria 'websockets' non installata — esegui pip install websockets")
        await websocket.close(code=1011)
    except Exception as e:
        logger.error(f"[ws-proxy] ERRORE ({target_url}): {type(e).__name__}: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@app.websocket("/api/sip/ws")
async def proxy_sip_ws(websocket: WebSocket):
    """
    Proxy WebSocket SIP → Asterisk ws://127.0.0.1:8088/ws
    Necessario perché l'app è servita via HTTPS e il browser blocca ws:// diretto.
    JsSIP si connette a wss://host/api/sip/ws → backend proxia a ws://127.0.0.1:8088/ws.
    Preserva il subprotocol 'sip' richiesto da JsSIP.
    """
    # Verifica API key prima di accettare la connessione
    api_key = websocket.headers.get("x-api-key") or websocket.query_params.get("key")
    if not WEB_API_KEY or api_key != WEB_API_KEY:
        await websocket.close(code=1008)
        return

    # Leggi il subprotocol richiesto dal client (di solito "sip")
    requested_sub = websocket.headers.get("sec-websocket-protocol", "")
    subprotocol = requested_sub.split(",")[0].strip() if requested_sub else None
    await websocket.accept(subprotocol=subprotocol)

    asterisk_ws_url = f"ws://{AMI_HOST}:8088/ws"
    logger.info(f"[sip-ws-proxy] Nuovo client: {websocket.client}, subprotocol={subprotocol}")
    try:
        import websockets as ws_lib
        extra = {"subprotocols": [subprotocol]} if subprotocol else {}
        async with ws_lib.connect(asterisk_ws_url, **extra) as ast_ws:
            async def from_asterisk():
                async for msg in ast_ws:
                    if isinstance(msg, bytes):
                        await websocket.send_bytes(msg)
                    else:
                        await websocket.send_text(msg)

            async def to_asterisk():
                try:
                    async for msg in websocket.iter_text():
                        await ast_ws.send(msg)
                except Exception:
                    pass

            tasks = [
                asyncio.ensure_future(from_asterisk()),
                asyncio.ensure_future(to_asterisk()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            logger.info("[sip-ws-proxy] Sessione terminata")
    except Exception as e:
        logger.error(f"[sip-ws-proxy] ERRORE: {type(e).__name__}: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


# --- Serve React frontend ---
frontend_dist = "/opt/doorbell/frontend/dist"
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=f"{frontend_dist}/assets"), name="assets")

    _NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}

    @app.get("/")
    async def serve_index():
        return FileResponse(f"{frontend_dist}/index.html", headers=_NO_CACHE)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = f"{frontend_dist}/{full_path}"
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(f"{frontend_dist}/index.html", headers=_NO_CACHE)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=False,
    )
