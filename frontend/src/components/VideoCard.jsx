import { useState, useEffect, useRef } from 'react'

// Safari/iOS non supporta MJPEG multipart in <img> — usa snapshot polling
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

const STREAM_META = { codec: 'H.264', fps: '25', bitrate: '2.1 Mbps' }

function NoSignal() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black noise-bg animate-noise">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-3 opacity-20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
            className="text-white w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <p className="text-[10px] font-mono text-white/20 tracking-widest uppercase">No Signal</p>
      </div>
    </div>
  )
}

export default function VideoCard({ streamUrls, status, dark = true, compact = false }) {
  const [loaded,   setLoaded]   = useState(false)
  const [imgError, setImgError] = useState(false)
  // iOS snapshot polling
  const [snapSrc,  setSnapSrc]  = useState(null)
  const timerRef = useRef(null)
  const isRinging = status === 'ringing'

  // iOS: snapshot polling ogni 500ms invece di MJPEG
  useEffect(() => {
    if (!isIOS || !streamUrls?.snapshot) return

    const refresh = () => {
      // Bust cache aggiungendo timestamp
      setSnapSrc(streamUrls.snapshot + (streamUrls.snapshot.includes('?') ? '&' : '?') + '_t=' + Date.now())
    }
    refresh()
    timerRef.current = setInterval(refresh, 500)
    return () => clearInterval(timerRef.current)
  }, [streamUrls?.snapshot])

  const aspectClass = compact ? 'aspect-video' : 'aspect-[16/10]'
  const borderClass = dark
    ? `border border-[#333] ${isRinging ? 'animate-ring-glow' : ''}`
    : `border border-geist-gray-200 shadow-geist-sm ${isRinging ? 'ring-2 ring-red-400/50' : ''}`

  return (
    <div className={`relative w-full ${aspectClass} rounded-geist overflow-hidden bg-black ${borderClass}`}>

      {/* iOS: snapshot polling */}
      {isIOS && snapSrc ? (
        <img
          src={snapSrc}
          className={`absolute inset-0 w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
          alt="Live"
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : null}

      {/* Desktop: MJPEG nativo */}
      {!isIOS && streamUrls?.mjpeg && !imgError ? (
        <img
          src={streamUrls.mjpeg}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          alt="Live"
          onLoad={() => setLoaded(true)}
          onError={() => { console.error('[VideoCard] MJPEG error'); setImgError(true) }}
        />
      ) : null}

      {/* No signal */}
      {(!loaded || imgError) && <NoSignal />}

      {/* LIVE badge */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded-[4px]">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
        <span className="text-[9px] font-bold tracking-[0.12em] text-white uppercase">
          {isRinging ? 'Suona' : 'Live'}
        </span>
      </div>

      {/* Metadata tecnici (solo dark mode) */}
      {dark && loaded && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2
          bg-gradient-to-t from-black/80 to-transparent">
          <p className="font-mono text-[9px] text-white/50 tracking-wide">
            {STREAM_META.codec} &nbsp;•&nbsp; {STREAM_META.bitrate} &nbsp;•&nbsp; {isIOS ? '2 fps' : STREAM_META.fps + ' fps'}
          </p>
        </div>
      )}
    </div>
  )
}
