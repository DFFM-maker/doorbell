import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SentinelView  from './views/SentinelView'
import ConciergeView from './views/ConciergeView'
import OpsView       from './views/OpsView'
import BottomNav     from './components/BottomNav'

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
  const [view,          setView]          = useState('sentinel')
  const [prevView,      setPrevView]      = useState('sentinel')
  const [status,        setStatus]        = useState('idle')
  const [streamUrls,    setStreamUrls]    = useState(null)
  const [currentPreset, setCurrentPreset] = useState('')
  const [presets,       setPresets]       = useState([])
  const [gateState,     setGateState]     = useState('idle')   // idle | loading | success | error
  const [ptzLoading,    setPtzLoading]    = useState(null)     // token in movimento
  const [events,        setEvents]        = useState([...INITIAL_EVENTS].reverse())
  const sseRef = useRef(null)

  const addEvent = useCallback((type, message) =>
    setEvents(prev => [mkEvent(type, message), ...prev].slice(0, 60)), [])

  // ── Fetch stream URLs ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/frigate/stream-url')
      .then(r => r.json())
      .then(setStreamUrls)
      .catch(console.error)
  }, [])

  // ── Fetch PTZ presets ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/ptz/presets')
      .then(r => r.json())
      .then(d => {
        setPresets(d.presets || [])
        if (d.current) setCurrentPreset(d.current)
      })
      .catch(console.error)
  }, [])

  // ── Fetch initial status ───────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/status')
      .then(r => r.json())
      .then(d => {
        setStatus(d.status)
        if (d.current_preset) setCurrentPreset(d.current_preset)
      })
      .catch(console.error)
  }, [])

  // ── SSE real-time ──────────────────────────────────────────────────────────
  useEffect(() => {
    let es, retryTimer

    function connect() {
      es = new EventSource('/api/v1/events')

      es.addEventListener('status', e => {
        const s = e.data
        setStatus(s)
        if (s === 'ringing') {
          addEvent('DOORBELL_RING', 'Campanello premuto')
          if (Notification?.permission === 'granted') {
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

    if (Notification?.permission === 'default') Notification.requestPermission()
    connect()
    return () => { clearTimeout(retryTimer); es?.close() }
  }, [presets, addEvent])

  // ── Open gate ──────────────────────────────────────────────────────────────
  const handleOpenGate = useCallback(async () => {
    if (gateState === 'loading') return
    setGateState('loading')
    try {
      const res = await fetch('/api/v1/open-gate', { method: 'POST' })
      if (res.ok) {
        setGateState('success')
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
  }, [gateState, addEvent])

  // ── PTZ goto ───────────────────────────────────────────────────────────────
  const handlePresetChange = useCallback(async (token) => {
    if (ptzLoading) return
    setPtzLoading(token)
    try {
      await fetch(`/api/v1/ptz/goto/${token}`, { method: 'POST' })
      setCurrentPreset(token)
    } catch (e) {
      console.error('[App] PTZ error:', e)
    }
    setTimeout(() => setPtzLoading(null), 2000)
  }, [ptzLoading])

  // ── View change ────────────────────────────────────────────────────────────
  const handleViewChange = (next) => {
    setPrevView(view)
    setView(next)
  }

  const vars = slideVariants(prevView, view)

  // ── BG color per view ──────────────────────────────────────────────────────
  const bgMap = { sentinel: 'bg-black', concierge: 'bg-white', ops: 'bg-geist-gray-50' }

  return (
    <div className={`flex flex-col h-dvh ${bgMap[view]} transition-colors duration-300`}>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={vars.initial}
          animate={vars.animate}
          exit={vars.exit}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col flex-1 overflow-hidden"
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

      <BottomNav view={view} onChange={handleViewChange} />
    </div>
  )
}
