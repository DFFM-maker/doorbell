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

// Costruisce l'URL WebSocket SIP usando il proxy backend (evita mixed-content su HTTPS)
function getSipWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost/api/sip/ws'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/api/sip/ws`
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
      password:           'webapp123',
      display_name:       'Webapp',
      register:           true,
      register_expires:   60,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    }

    // Log JsSIP attivo (utile per debug — visibile nella console del browser)
    JsSIP.debug.enable('JsSIP:*')

    const ua = new JsSIP.UA(config)
    uaRef.current = ua

    ua.on('connected',    () => console.log('[SIP] WS connesso'))
    ua.on('disconnected', () => {
      console.warn('[SIP] WS disconnesso')
      setSipStatus(s => s === 'active' || s === 'ringing' ? s : 'error')
    })
    ua.on('registered',   () => {
      console.log('[SIP] Registrato come webapp')
      setSipStatus('idle')
    })
    ua.on('unregistered', () => setSipStatus('error'))
    ua.on('registrationFailed', (e) => {
      console.error('[SIP] Registrazione fallita:', e.cause)
      setSipStatus('error')
    })

    ua.on('newRTCSession', (data) => {
      const session = data.session
      if (session.direction !== 'incoming') return

      // Scarta se siamo già in una chiamata
      if (sessionRef.current) {
        session.terminate()
        return
      }

      sessionRef.current = session
      const from = session.remote_identity?.display_name
             || session.remote_identity?.uri?.user
             || 'Citofono'
      setCaller(from)
      setSipStatus('ringing')

      session.on('ended',   () => { sessionRef.current = null; setSipStatus('idle'); setMuted(false) })
      session.on('failed',  () => { sessionRef.current = null; setSipStatus('idle'); setMuted(false) })
      session.on('accepted', () => setSipStatus('active'))

      // Aggancia audio remoto quando arriva la traccia
      session.connection?.addEventListener('track', (ev) => {
        if (ev.streams && ev.streams[0] && audioRef.current) {
          audioRef.current.srcObject = ev.streams[0]
          audioRef.current.play().catch(console.error)
        }
      })
    })

    ua.start()

    return () => {
      ua.stop()
      uaRef.current   = null
      sessionRef.current = null
    }
  }, [])

  // ── Azioni ────────────────────────────────────────────────────────────────
  const answer = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    s.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [] },
    })
    // Aggancia audio remoto
    s.connection?.addEventListener('track', (ev) => {
      if (ev.streams && ev.streams[0] && audioRef.current) {
        audioRef.current.srcObject = ev.streams[0]
        audioRef.current.play().catch(console.error)
      }
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
          <div
            className="fixed bottom-0 left-0 right-0 z-[1000] w-full max-w-[100vw]
                       px-4 pointer-events-auto box-border"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)', paddingTop: '16px' }}
          >
            <motion.div
              key="sipphone"
              initial={{ opacity: 0, y: 150 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 150 }}
              transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white border border-geist-gray-200 rounded-3xl
                         shadow-[0_-5px_40px_rgba(0,0,0,0.3)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-5 border-b border-geist-gray-100 bg-geist-gray-50/50">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  sipStatus === 'ringing' ? 'bg-red-500 animate-live-pulse' : 'bg-geist-success'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-geist uppercase text-geist-gray-500">
                    {sipStatus === 'ringing' ? 'Chiamata in arrivo' : 'Chiamata attiva'}
                  </p>
                  <p className="text-lg font-bold text-black truncate">{caller}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 px-5 py-8 bg-white w-full">
                {sipStatus === 'ringing' && (
                  <>
                    <button
                      onClick={reject}
                      className="flex-1 flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
                    >
                      <div className="w-full max-w-[80px] aspect-square flex items-center justify-center
                                       rounded-2xl bg-red-500 text-white shadow-lg">
                        <PhoneOff size={32} strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] font-bold text-geist-gray-600 uppercase tracking-widest">Rifiuta</span>
                    </button>

                    <button
                      onClick={answer}
                      className="flex-1 flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
                    >
                      <div className="w-full max-w-[80px] aspect-square flex items-center justify-center
                                       rounded-2xl bg-geist-success text-white shadow-lg animate-ring-glow">
                        <PhoneIncoming size={32} strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] font-bold text-geist-gray-600 uppercase tracking-widest">Rispondi</span>
                    </button>
                  </>
                )}

                {sipStatus === 'active' && (
                  <>
                    <button
                      onClick={toggleMute}
                      className="flex-1 flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
                    >
                      <div className={`w-full max-w-[80px] aspect-square flex items-center justify-center
                                       rounded-2xl shadow-md transition-all
                                       ${muted ? 'bg-geist-gray-800 text-white' : 'bg-geist-gray-100 text-geist-gray-700'}`}>
                        {muted ? <MicOff size={28} /> : <Mic size={28} />}
                      </div>
                      <span className="text-[11px] font-bold text-geist-gray-600 uppercase tracking-widest">
                        {muted ? 'Unmute' : 'Mute'}
                      </span>
                    </button>

                    <button
                      onClick={hangup}
                      className="flex-1 flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
                    >
                      <div className="w-full max-w-[80px] aspect-square flex items-center justify-center
                                       rounded-2xl bg-red-500 text-white shadow-lg">
                        <PhoneOff size={28} />
                      </div>
                      <span className="text-[11px] font-bold text-geist-gray-600 uppercase tracking-widest">Chiudi</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Indicatori di stato fissi */}
      <div
        className="fixed z-[900] right-6"
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 16px))' }}
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
