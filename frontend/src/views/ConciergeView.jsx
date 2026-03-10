import { motion, AnimatePresence } from 'framer-motion'
import { LockOpen, Check, BellOff, Lightbulb, ScrollText, ChevronRight } from 'lucide-react'
import VideoCard from '../components/VideoCard'

// ── Gate Button (light) ─────────────────────────────────────────────────────
function GateBtn({ state, onClick }) {
  const isLoading = state === 'loading'
  const isSuccess = state === 'success'
  const isError   = state === 'error'

  return (
    <motion.button
      onClick={!isLoading ? onClick : undefined}
      disabled={isLoading}
      whileTap={{ scale: isLoading ? 1 : 0.97 }}
      className={`
        relative w-full flex items-center justify-center gap-2.5
        py-4 rounded-geist font-semibold text-sm tracking-wide
        transition-colors duration-300
        ${isLoading  ? 'bg-geist-gray-100 text-geist-gray-400 cursor-not-allowed' : ''}
        ${isSuccess  ? 'bg-geist-success text-white' : ''}
        ${isError    ? 'bg-geist-error text-white' : ''}
        ${!isLoading && !isSuccess && !isError ? 'bg-black text-white hover:bg-geist-gray-900 active:bg-geist-gray-800' : ''}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading && (
          <motion.div key="spin"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="w-4 h-4 rounded-full border-2 border-geist-gray-300 border-t-geist-gray-600 animate-spin"
          />
        )}
        {isSuccess && (
          <motion.div key="check"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}>
            <Check size={18} strokeWidth={2.5} />
          </motion.div>
        )}
        {!isLoading && !isSuccess && !isError && (
          <motion.div key="lock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}>
            <LockOpen size={18} strokeWidth={2} />
          </motion.div>
        )}
      </AnimatePresence>
      <span>
        {isLoading ? 'Apertura…' : isSuccess ? 'Cancello Aperto' : isError ? 'Errore' : 'Apri Cancello'}
      </span>
    </motion.button>
  )
}

// ── Quick Actions ────────────────────────────────────────────────────────────
const ACTIONS = [
  { icon: BellOff,   label: 'Mute Alerts',  sub: 'Silenzia notifiche' },
  { icon: Lightbulb, label: 'Porch Light',  sub: 'Luce ingresso' },
  { icon: ScrollText,label: 'Event Logs',   sub: 'Apri storico eventi' },
]

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    idle:    { dot: 'bg-geist-gray-400', text: 'text-geist-gray-600', label: 'Inattivo' },
    ringing: { dot: 'bg-red-500 animate-live-pulse', text: 'text-red-600', label: 'Suona' },
    active:  { dot: 'bg-geist-success', text: 'text-geist-success', label: 'Attivo' },
  }
  const s = map[status] ?? map.idle
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Main View ────────────────────────────────────────────────────────────────
export default function ConciergeView({ status, streamUrls, gateState, onOpenGate }) {
  return (
    <div className="flex flex-col flex-1 bg-white text-black overflow-y-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-geist-gray-200">
        <h1 className="text-[11px] font-bold tracking-geist uppercase text-geist-gray-500">
          Concierge
        </h1>
        <StatusPill status={status} />
      </header>

      <div className="flex flex-col gap-0 divide-y divide-geist-gray-200">

        {/* Video compatto */}
        <div className="px-4 py-4">
          <VideoCard streamUrls={streamUrls} status={status} dark={false} compact />
        </div>

        {/* Quick Actions */}
        <div>
          <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold tracking-geist uppercase text-geist-gray-500">
            Quick Actions
          </p>
          {ACTIONS.map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              className="w-full flex items-center gap-3 px-4 py-3.5
                hover:bg-geist-gray-50 active:bg-geist-gray-100
                border-t border-geist-gray-100 first:border-0
                transition-colors duration-100"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-geist bg-geist-gray-100">
                <Icon size={15} strokeWidth={1.8} className="text-geist-gray-700" />
              </span>
              <span className="flex-1 text-left">
                <p className="text-sm font-medium text-black">{label}</p>
                <p className="text-xs text-geist-gray-500 mt-0.5">{sub}</p>
              </span>
              <ChevronRight size={16} strokeWidth={1.5} className="text-geist-gray-400" />
            </button>
          ))}
        </div>

        {/* Gate button */}
        <div className="px-4 py-4">
          <GateBtn state={gateState} onClick={onOpenGate} />
        </div>

      </div>
    </div>
  )
}
