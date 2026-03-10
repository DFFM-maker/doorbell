import { useRef, useCallback } from 'react'

/**
 * Sintetizza un "Ding-Dong" bitonale tramite Web Audio API.
 * Nessun file MP3 richiesto.
 *
 * iOS/Safari blocca l'audio finché l'utente non interagisce con la pagina.
 * Chiamare `unlock()` dentro qualsiasi gestore di evento utente (click, submit)
 * per sbloccare il contesto audio prima che serva.
 */
export function useDoorbellSound() {
  const ctxRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return null
      ctxRef.current = new AudioCtx()
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  // Chiama questo al primo gesto utente (click, submit) per sbloccare l'audio su iOS
  const unlock = useCallback(() => { getCtx() }, [getCtx])

  const playDingDong = useCallback(() => {
    const ctx = getCtx()
    if (!ctx || ctx.state === 'suspended') return

    const playTone = (freq, startTime, duration, volume = 0.55) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)

      // Attacco rapido, decadimento naturale
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    const now = ctx.currentTime
    playTone(880, now,        1.4)  // "Ding" — La5  (880 Hz)
    playTone(659, now + 0.65, 1.4)  // "Dong" — Mi5  (659 Hz)
  }, [getCtx])

  return { playDingDong, unlock }
}
