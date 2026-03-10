import './StatusBadge.css'

const STATUS_CONFIG = {
  idle: { label: 'In attesa', color: 'gray', dot: true },
  ringing: { label: 'SUONA!', color: 'red', dot: true, pulse: true },
  active: { label: 'Attivo', color: 'green', dot: true },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle
  return (
    <div className={`sb sb--${cfg.color} ${cfg.pulse ? 'sb--pulse' : ''}`}>
      {cfg.dot && <span className="sb-dot" />}
      {cfg.label}
    </div>
  )
}
