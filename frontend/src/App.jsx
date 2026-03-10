import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SentinelView  from './views/SentinelView'
import ConciergeView from './views/ConciergeView'
import OpsView       from './views/OpsView'
import BottomNav     from './components/BottomNav'
import AuthScreen    from './components/AuthScreen'
import { useDoorbellSound } from './hooks/useDoorbellSound'

const LS_KEY = 'doorbell_api_key'

// ── Event log helpers ────────────────────────────────────────────────────────
let _eid = 0
const mkEvent = (type, message) => ({ id: ++_eid, type, message, time: new Date() })

const INITIAL_EVENTS = [
  mkEvent('SYSTEM',          'Backend avviato'),
  mkEvent('MOTION_DETECTED', 'Movimento rilevato — zona ingresso'),
  mkEvent('DOORBELL_RING',   'Campanello premuto'),
  mkEvent('ACCESS_GRANTED',  'Cancello aperto manualmente'),
]

// ── Slide transition ─────────────────────────────────────────────────────────
const VIEW_ORDER = ['sentinel', 'concierge', 'ops']
function slideVariants(prev, next) {
  const pi = VIEW_ORDER.indexOf(prev)
  const ni = VIEW_ORDER.indexOf(next)
  const dir = ni > pi ? 1 : -1
  return {
    initial: { opacity: 0, x: dir * 24 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -dir * 24 },
  }
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,        setApiKey]        = useState(() => localStorage.getItem(LS_KEY) || '')
  const [authError,     setAuthError]     = useState(false)
  const [view,          setView]          = useState('sentinel')
  const [prevView,      setPrevView]      = useState('sentinel')
  const [status,        setStatus]        = useState('idle')
  const [streamUrls,    setStreamUrls]    = useState(null)
  const [currentPreset, setCurrentPreset] = useState('')
  const [presets,       setPresets]       = useState([])
  const [gateState,     setGateState]     = useState('idle')
  const [ptzLoading,    setPtzLoading]    = useState(null)
  const [events,        setEvents]        = useState([...INITIAL_EVENTS].reverse())
  const sseRef = useRef(null)

  // ── Audio ──────────────────────────────────────────────────────────────────
  const { playDingDong, unlock } = useDoorbellSound()

  // ── Auth helpers ───────────────────────────────────────────────────────────
  const apiFetch = useCallback((url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: { 'X-API-Key': apiKey, ...(opts.headers || {}) },
    })
  }, [apiKey])

  const handleAuth = useCallback(async (key) => {
    unlock() // sblocca AudioContext su iOS al primo gesto utente
    const res = await fetch('/api/v1/status', { headers: { 'X-API-Key': key } })
    if (res.ok) {
      localStorage.setItem(LS_KEY, key)
      setApiKey(key)
      setAuthError(false)
    } else {
      setAuthError(true)
      setTimeout(() => setAuthError(false), 1500)
    }
  }, [unlock])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setApiKey('')
  }, [])

  const addEvent = useCallback((type, message) =>
    setEvents(prev => [mkEvent(type, message), ...prev].slice(0, 60)), [])

  // ── Fetch stream URLs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return
    apiFetch('/api/v1/frigate/stream-url')
      .then(r => r.json())
      .then(d => setStreamUrls({ mjpeg: d.mjpeg + `?key=${encodeURIComponent(apiKey)}`, snapshot: d.snapshot }))
      .catch(console.error)
  }, [apiFetch, apiKey])

  // ── Fetch PTZ presets ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return
    apiFetch('/api/v1/ptz/presets')
      .then(r => r.json())
      .then(d => {
        setPresets(d.presets || [])
        if (d.current) setCurrentPreset(d.current)
      })
      .catch(console.error)
  }, [apiFetch])

  // ── Fetch initial status ───────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return
    apiFetch('/api/v1/status')
      .then(r => { if (r.status === 401) { handleLogout(); return null } return r.json() })
      .then(d => {
        if (!d) return
        setStatus(d.status)
        if (d.current_preset) setCurrentPreset(d.current_preset)
      })
      .catch(console.error)
  }, [apiFetch, handleLogout])

  // ── Suono campanello ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ringing') return
    playDingDong()
    const t = setInterval(playDingDong, 5000)
    return () => clearInterval(t)
  }, [status, playDingDong])

  // ── SSE real-time ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return
    let es, retryTimer

    function connect() {
      es = new EventSource(`/api/v1/events?key=${encodeURIComponent(apiKey)}`)

      es.addEventListener('status', e => {
        const s = e.data
        setStatus(s)
        if (s === 'ringing') {
          addEvent('DOORBELL_RING', 'Campanello premuto')
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Citofono', { body: 'Qualcuno ha suonato!', tag: 'doorbell' })
          }
        }
        if (s === 'idle') setGateState(prev => prev === 'success' ? prev : 'idle')
      })

      es.addEventListener('ptz', e => {
        setCurrentPreset(e.data)
        const name = presets.find(p => p.token === e.data)?.name ?? `Preset ${e.data}`
        addEvent('SYSTEM', `PTZ → ${name}`)
      })

      es.onerror = () => { es.close(); retryTimer = setTimeout(connect, 3000) }
      sseRef.current = es
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    connect()
    return () => { clearTimeout(retryTimer); es?.close() }
  }, [presets, addEvent, apiKey])

  // ── Open gate ──────────────────────────────────────────────────────────────
  const handleOpenGate = useCallback(async () => {
    if (gateState === 'loading') return
    setGateState('loading')
    try {
      const res = await apiFetch('/api/v1/open-gate', { method: 'POST' })
      if (res.status === 401) { handleLogout(); return }
      if (res.ok) {
        setGateState('success')
        setStatus('idle')
        addEvent('ACCESS_GRANTED', 'Cancello aperto')
      } else {
        setGateState('error')
        addEvent('SYSTEM', `Errore apertura cancello (${res.status})`)
      }
    } catch {
      setGateState('error')
      addEvent('SYSTEM', 'Errore rete — apertura cancello fallita')
    }
    setTimeout(() => setGateState('idle'), 2500)
  }, [gateState, addEvent, apiFetch, handleLogout])

  // ── PTZ goto ───────────────────────────────────────────────────────────────
  const handlePresetChange = useCallback(async (token) => {
    if (ptzLoading) return
    setPtzLoading(token)
    try {
      const res = await apiFetch(`/api/v1/ptz/goto/${token}`, { method: 'POST' })
      if (res.status === 401) { handleLogout(); return }
      setCurrentPreset(token)
    } catch (e) {
      console.error('[App] PTZ error:', e)
    }
    setTimeout(() => setPtzLoading(null), 2000)
  }, [ptzLoading, apiFetch, handleLogout])

  // ── View change ────────────────────────────────────────────────────────────
  const handleViewChange = (next) => {
    setPrevView(view)
    setView(next)
  }

  // ── Auth gate — DOPO tutti gli hook ───────────────────────────────────────
  if (!apiKey) {
    return <AuthScreen onAuth={handleAuth} error={authError} />
  }

  const vars = slideVariants(prevView, view)

  // ── BG color per view ──────────────────────────────────────────────────────
  const bgMap = { sentinel: 'bg-black', concierge: 'bg-white', ops: 'bg-geist-gray-50' }

  return (
    <div className={`fixed inset-0 flex flex-col ${bgMap[view]} transition-colors duration-300`} onClick={unlock}>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={vars.initial}
          animate={vars.animate}
          exit={vars.exit}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col flex-1 overflow-x-hidden overflow-y-auto"
        >
          {view === 'sentinel' && (
            <SentinelView
              status={status}
              streamUrls={streamUrls}
              currentPreset={currentPreset}
              presets={presets}
              gateState={gateState}
              onOpenGate={handleOpenGate}
              onPresetChange={handlePresetChange}
              ptzLoading={ptzLoading}
            />
          )}
          {view === 'concierge' && (
            <ConciergeView
              status={status}
              streamUrls={streamUrls}
              gateState={gateState}
              onOpenGate={handleOpenGate}
            />
          )}
          {view === 'ops' && (
            <OpsView
              events={events}
              status={status}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <BottomNav view={view} onChange={handleViewChange} dark={view === 'sentinel'} />
    </div>
  )
}
