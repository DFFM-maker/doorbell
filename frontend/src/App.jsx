import { useState, useEffect, useRef, useCallback } from 'react'
import VideoPlayer from './components/VideoPlayer'
import StatusBadge from './components/StatusBadge'
import GateButton from './components/GateButton'
import RingTimer from './components/RingTimer'
import PtzSelector from './components/PtzSelector'
import './App.css'

const API_BASE = ''  // same origin when served by FastAPI

export default function App() {
  const [status, setStatus] = useState('idle')       // idle | ringing | active
  const [ringTime, setRingTime] = useState(null)
  const [gateLoading, setGateLoading] = useState(false)
  const [gateResult, setGateResult] = useState(null)  // null | 'ok' | 'error'
  const [streamUrls, setStreamUrls] = useState(null)
  const [currentPreset, setCurrentPreset] = useState('')
  const sseRef = useRef(null)

  // Fetch stream URLs once
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/frigate/stream-url`)
      .then(r => r.json())
      .then(setStreamUrls)
      .catch(() => {})
  }, [])

  // Fetch initial status
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/status`)
      .then(r => r.json())
      .then(data => {
        setStatus(data.status)
        if (data.ring_time) setRingTime(new Date(data.ring_time))
        if (data.current_preset) setCurrentPreset(data.current_preset)
      })
      .catch(() => {})
  }, [])

  // SSE for real-time updates
  useEffect(() => {
    let es
    let retryTimeout

    function connect() {
      es = new EventSource(`${API_BASE}/api/v1/events`)

      es.addEventListener('ptz', (e) => {
        setCurrentPreset(e.data)
      })

      es.addEventListener('status', (e) => {
        const newStatus = e.data
        setStatus(newStatus)
        if (newStatus === 'ringing') {
          setRingTime(new Date())
          // Request notification permission and show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Citofono', {
              body: 'Qualcuno ha suonato!',
              icon: '/bell.svg',
              tag: 'doorbell',
            })
          }
        } else if (newStatus === 'idle') {
          setRingTime(null)
          setGateResult(null)
        }
      })

      es.onerror = () => {
        es.close()
        retryTimeout = setTimeout(connect, 3000)
      }

      sseRef.current = es
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    connect()
    return () => {
      clearTimeout(retryTimeout)
      es?.close()
    }
  }, [])

  const handleOpenGate = useCallback(async () => {
    setGateLoading(true)
    setGateResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/v1/open-gate`, { method: 'POST' })
      if (res.ok) {
        setGateResult('ok')
      } else {
        setGateResult('error')
      }
    } catch {
      setGateResult('error')
    } finally {
      setGateLoading(false)
      setTimeout(() => setGateResult(null), 3000)
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="header-icon">🔔</span>
          <span className="header-title">Video Citofono</span>
        </div>
        <StatusBadge status={status} />
      </header>

      <main className="app-main">
        {/* Video feed */}
        <div className="video-section">
          <VideoPlayer streamUrls={streamUrls} status={status} />
        </div>

        {/* Status & timer */}
        {status === 'ringing' && ringTime && (
          <div className="ring-alert">
            <div className="ring-alert-icon">🔔</div>
            <div className="ring-alert-text">
              <strong>Qualcuno ha suonato!</strong>
              <RingTimer ringTime={ringTime} timeout={120} />
            </div>
          </div>
        )}

        {/* Selezione preset PTZ */}
        <PtzSelector
          currentPreset={currentPreset}
          onPresetChange={setCurrentPreset}
        />

        {/* Gate button */}
        <div className="actions">
          <GateButton
            onClick={handleOpenGate}
            loading={gateLoading}
            result={gateResult}
          />
        </div>

        {/* Info footer */}
        <div className="info-row">
          <span className="info-chip">
            📡 Frigate: <code>cancello_ptz</code>
          </span>
          <span className="info-chip">
            🏠 HA connesso
          </span>
        </div>
      </main>
    </div>
  )
}
