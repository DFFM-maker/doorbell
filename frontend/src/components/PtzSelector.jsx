import { useState, useEffect } from 'react'
import './PtzSelector.css'

export default function PtzSelector({ currentPreset, onPresetChange }) {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(null)  // token in movimento

  useEffect(() => {
    fetch('/api/v1/ptz/presets')
      .then(r => r.json())
      .then(data => setPresets(data.presets || []))
      .catch(e => console.error('[PtzSelector] Errore caricamento preset:', e))
  }, [])

  const handleGoto = async (token) => {
    if (loading) return
    setLoading(token)
    try {
      const res = await fetch(`/api/v1/ptz/goto/${token}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        console.error('[PtzSelector] Errore goto:', err)
      } else {
        onPresetChange?.(token)
      }
    } catch (e) {
      console.error('[PtzSelector] Errore rete:', e)
    } finally {
      // Piccolo delay: la camera impiega qualche secondo a muoversi
      setTimeout(() => setLoading(null), 2000)
    }
  }

  if (!presets.length) return null

  return (
    <div className="ptz-selector">
      <span className="ptz-label">📷 Vista</span>
      <div className="ptz-buttons">
        {presets.map(({ name, token }) => {
          const isActive  = token === currentPreset
          const isMoving  = token === loading
          return (
            <button
              key={token}
              className={`ptz-btn ${isActive ? 'ptz-btn--active' : ''} ${isMoving ? 'ptz-btn--moving' : ''}`}
              onClick={() => handleGoto(token)}
              disabled={!!loading}
              title={`Preset ${token}`}
            >
              {isMoving ? <span className="ptz-spin" /> : null}
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
