import { useState, useEffect, useRef } from 'react'
import './VideoPlayer.css'

// Rileva iOS/Safari che non supporta MJPEG nativo in <img>
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

export default function VideoPlayer({ streamUrls, status }) {
  const [mode, setMode] = useState('live')   // live | foto
  const [snapUrl, setSnapUrl] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [usePoll, setUsePoll] = useState(isIOS)  // iOS: polling invece di MJPEG
  const pollRef = useRef(null)
  const mjpegRef = useRef(null)

  // Polling snapshot (iOS o fallback MJPEG)
  useEffect(() => {
    if (!streamUrls?.snapshot) return
    if (mode === 'live' && usePoll) {
      const refresh = () => setSnapUrl(`${streamUrls.snapshot}?t=${Date.now()}`)
      refresh()
      pollRef.current = setInterval(refresh, 400)   // ~2.5 fps
      return () => clearInterval(pollRef.current)
    }
    if (mode === 'foto') {
      const refresh = () => setSnapUrl(`${streamUrls.snapshot}?t=${Date.now()}`)
      refresh()
      pollRef.current = setInterval(refresh, 3000)  // 1 foto ogni 3s
      return () => clearInterval(pollRef.current)
    }
  }, [mode, streamUrls, usePoll])

  // Reset errore al cambio tab
  useEffect(() => { setImgError(false) }, [mode])

  if (!streamUrls) {
    return (
      <div className="vp-placeholder">
        <div className="vp-spinner" />
        <p>Connessione al NVR...</p>
      </div>
    )
  }

  const isRinging = status === 'ringing'

  return (
    <div className={`vp-container ${isRinging ? 'vp-ringing' : ''}`}>

      {/* Tab selector */}
      <div className="vp-tabs">
        {[['live', '● Live'], ['foto', '📷 Foto']].map(([m, label]) => (
          <button
            key={m}
            className={`vp-tab ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stream */}
      <div className="vp-stream">

        {/* LIVE: MJPEG nativo (Chrome/Firefox/Android) */}
        {mode === 'live' && !usePoll && !imgError && (
          <img
            ref={mjpegRef}
            src={streamUrls.mjpeg}
            className="vp-img"
            alt="Live stream"
            onError={(e) => {
              console.error('[VideoPlayer] MJPEG non supportato, fallback a polling:', e)
              setUsePoll(true)
            }}
          />
        )}

        {/* LIVE: polling snapshot (iOS o fallback) */}
        {mode === 'live' && usePoll && snapUrl && !imgError && (
          <img
            src={snapUrl}
            className="vp-img"
            alt="Live snapshot"
            onError={(e) => {
              console.error('[VideoPlayer] Snapshot live error:', snapUrl, e)
              setImgError(true)
            }}
          />
        )}

        {/* FOTO: snapshot singolo */}
        {mode === 'foto' && snapUrl && !imgError && (
          <img
            src={snapUrl}
            className="vp-img"
            alt="Camera snapshot"
            onError={(e) => {
              console.error('[VideoPlayer] Snapshot foto error:', snapUrl, e)
              setImgError(true)
            }}
          />
        )}

        {/* Errore generico */}
        {imgError && (
          <div className="vp-error">
            <span className="vp-error-icon">⚠</span>
            <p>Stream non disponibile</p>
            <button className="vp-retry" onClick={() => setImgError(false)}>
              Riprova
            </button>
          </div>
        )}

      </div>

      {/* Badge live */}
      <div className={`vp-live-badge ${isRinging ? 'vp-live-badge--ring' : ''}`}>
        <span className="vp-live-dot" />
        {isRinging ? 'SUONA' : 'LIVE'}
      </div>
    </div>
  )
}
