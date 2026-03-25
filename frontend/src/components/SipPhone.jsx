/**
 * SipPhone.jsx
 * JsSIP WebRTC phone — si registra come 'webapp' su Asterisk via WebSocket.
 * Riceve chiamate in ingresso (dal citofono fisico o da Linphone in test).
 * Status: idle | ringing | active | error
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff } from 'lucide-react'
import JsSIP from 'jssip'

const Z_INDEX = { overlay: 9999, controls: 900 }

// Costruisce l'URL WebSocket SIP usando il proxy backend (evita mixed-content su HTTPS)
// Passa la API key come query param per autenticare il proxy
function getSipWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost/api/sip/ws'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const key = import.meta.env.VITE_SIP_API_KEY
  const keyParam = key ? `?key=${encodeURIComponent(key)}` : ''
  return `${proto}://${window.location.host}/api/sip/ws${keyParam}`
}

export default function SipPhone({ visible = true }) {
  const [sipStatus, setSipStatus] = useState('idle')   // idle | ringing | active | error
  const [muted,     setMuted]     = useState(false)
  const [caller,    setCaller]    = useState('')

  const uaRef       = useRef(null)
  const sessionRef  = useRef(null)
  const audioRef    = useRef(null)   // <audio> element per l'audio remoto

  // ── Registrazione JsSIP ───────────────────────────────────────────────────
  useEffect(() => {
    const wsUrl  = getSipWsUrl()
    const domain = window.location.hostname
    const socket = new JsSIP.WebSocketInterface(wsUrl)

    const config = {
      sockets:            [socket],
      uri:                `sip:webapp@${domain}`,
      password:           import.meta.env.VITE_SIP_PASSWORD,
      display_name:       'Webapp',
      register:           true,
      register_expires:   60,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    }

    if (import.meta.env.DEV) JsSIP.debug.enable('JsSIP:*')

    const ua = new JsSIP.UA(config)
    uaRef.current = ua

    ua.on('connected',    () => {})
    ua.on('disconnected', () => {
      setSipStatus(s => s === 'active' || s === 'ringing' ? s : 'error')
    })
    ua.on('registered',   () => setSipStatus('idle'))
    ua.on('unregistered', () => setSipStatus('error'))
    ua.on('registrationFailed', () => setSipStatus('error'))

    ua.on('newRTCSession', (data) => {
      const session = data.session
      if (session.direction !== 'incoming') return

      // Scarta se siamo già in una chiamata
      if (sessionRef.current) {
        session.terminate()
        return
      }

      sessionRef.current = session
      const raw = session.remote_identity?.display_name
               || session.remote_identity?.uri?.user
               || 'Citofono'
      setCaller(raw.slice(0, 40))
      setSipStatus('ringing')

      session.on('ended',   () => { sessionRef.current = null; setSipStatus('idle'); setMuted(false) })
      session.on('failed',  () => { sessionRef.current = null; setSipStatus('idle'); setMuted(false) })
      session.on('accepted', () => setSipStatus('active'))

      // Aggancia audio remoto quando arriva la traccia
      session.connection?.addEventListener('track', (ev) => {
        if (ev.streams && ev.streams[0] && audioRef.current) {
          audioRef.current.srcObject = ev.streams[0]
          audioRef.current.play().catch(() => {})
        }
      })
    })

    ua.start()

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
      }
      ua.stop()
      uaRef.current      = null
      sessionRef.current = null
    }
  }, [])

  // ── Azioni ────────────────────────────────────────────────────────────────
  const answer = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    s.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    })
  }, [])

  const reject = useCallback(() => {
    sessionRef.current?.terminate()
  }, [])

  const hangup = useCallback(() => {
    sessionRef.current?.terminate()
  }, [])

  const toggleMute = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    if (muted) { s.unmute({ audio: true }); setMuted(false) }
    else        { s.mute({ audio: true });   setMuted(true) }
  }, [muted])

  // ── Niente da mostrare se idle e non visibile ─────────────────────────────
  if (!visible && sipStatus === 'idle') return (
    <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
  )

  return (
    <>
      {/* Audio element nascosto — NON display:none per evitare blocchi iOS */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}
      />

      <AnimatePresence>
        {(sipStatus === 'ringing' || sipStatus === 'active') && (
          <motion.div
            key="sipphone"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 w-full bg-white
                       border-t border-geist-gray-200 shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
            style={{ borderRadius: '16px 16px 0 0', boxSizing: 'border-box', zIndex: Z_INDEX.overlay }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-geist-gray-200" />
            </div>

            {/* Header — centrato */}
            <div className="flex flex-col items-center gap-1 px-4 pt-2 pb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  sipStatus === 'ringing' ? 'bg-red-500 animate-live-pulse' : 'bg-geist-success'
                }`} />
                <p className="text-[10px] font-bold tracking-geist uppercase text-geist-gray-500">
                  {sipStatus === 'ringing' ? 'Chiamata in arrivo' : 'Chiamata attiva'}
                </p>
              </div>
              <p className="text-[18px] font-bold text-black">{caller}</p>
            </div>

            {/* Actions */}
            <div
              className="flex flex-row gap-3 px-4 w-full box-border"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)' }}
            >
              {sipStatus === 'ringing' && (
                <>
                  <button
                    onClick={reject}
                    aria-label="Rifiuta la chiamata"
                    className="flex-1 flex items-center justify-center gap-2 h-[52px]
                               rounded-xl bg-red-500 text-white font-semibold text-sm
                               active:scale-95 transition-transform shadow-md"
                  >
                    <PhoneOff size={20} strokeWidth={2.5} />
                    Rifiuta
                  </button>
                  <button
                    onClick={answer}
                    aria-label="Rispondi alla chiamata"
                    className="flex-1 flex items-center justify-center gap-2 h-[52px]
                               rounded-xl bg-[#22c55e] text-white font-semibold text-sm
                               active:scale-95 transition-transform shadow-md animate-ring-glow"
                  >
                    <PhoneIncoming size={20} strokeWidth={2.5} />
                    Rispondi
                  </button>
                </>
              )}

              {sipStatus === 'active' && (
                <>
                  <button
                    onClick={toggleMute}
                    aria-label={muted ? 'Riattiva microfono' : 'Disattiva microfono'}
                    aria-pressed={muted}
                    className={`flex-1 flex items-center justify-center gap-2 h-[52px]
                                rounded-xl font-semibold text-sm active:scale-95 transition-all shadow-sm
                                ${muted ? 'bg-geist-gray-800 text-white' : 'bg-geist-gray-100 text-geist-gray-700'}`}
                  >
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={hangup}
                    aria-label="Termina la chiamata"
                    className="flex-1 flex items-center justify-center gap-2 h-[52px]
                               rounded-xl bg-red-500 text-white font-semibold text-sm
                               active:scale-95 transition-transform shadow-md"
                  >
                    <PhoneOff size={18} />
                    Chiudi
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicatori di stato fissi */}
      <div
        className="fixed right-6"
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 16px))', zIndex: Z_INDEX.controls }}
      >
        {visible && sipStatus === 'idle' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-geist-gray-200 shadow-md">
            <div className="w-2 h-2 rounded-full bg-geist-success" />
            <Phone size={14} className="text-geist-gray-600" />
            <span className="text-[10px] font-bold text-geist-gray-600 uppercase tracking-widest">SIP Ready</span>
          </div>
        )}

        {visible && sipStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-50/90 backdrop-blur-xl border border-red-200 shadow-md">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <Phone size={14} className="text-red-500" />
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">SIP Error</span>
          </div>
        )}
      </div>
    </>
  )
}
