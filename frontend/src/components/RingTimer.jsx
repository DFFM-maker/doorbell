import { useState, useEffect } from 'react'
import './RingTimer.css'

export default function RingTimer({ ringTime, timeout }) {
  const [remaining, setRemaining] = useState(timeout)

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - ringTime.getTime()) / 1000)
      const left = Math.max(0, timeout - elapsed)
      setRemaining(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [ringTime, timeout])

  const pct = (remaining / timeout) * 100

  return (
    <div className="rt">
      <span className="rt-text">Chiude in {remaining}s</span>
      <div className="rt-bar">
        <div
          className="rt-fill"
          style={{ width: `${pct}%`, '--pct': pct }}
        />
      </div>
    </div>
  )
}
