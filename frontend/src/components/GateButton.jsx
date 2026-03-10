import './GateButton.css'

export default function GateButton({ onClick, loading, result }) {
  let label = '🔓 APRI CANCELLO'
  let extra = ''

  if (loading) {
    label = '⟳ Apertura...'
    extra = 'gb--loading'
  } else if (result === 'ok') {
    label = '✓ Cancello aperto!'
    extra = 'gb--success'
  } else if (result === 'error') {
    label = '✗ Errore — riprova'
    extra = 'gb--error'
  }

  return (
    <button
      className={`gb ${extra}`}
      onClick={onClick}
      disabled={loading}
    >
      {label}
    </button>
  )
}
