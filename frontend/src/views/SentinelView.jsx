import { motion, AnimatePresence } from 'framer-motion'
import { LockOpen, Check, Mic, Camera, Ear, PhoneOff } from 'lucide-react'
import VideoCard from '../components/VideoCard'

// ── Gate Button ─────────────────────────────────────────────────────────────
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
        transition-colors duration-300 overflow-hidden
        ${isLoading  ? 'bg-white/10 text-white/40 cursor-not-allowed' : ''}
        ${isSuccess  ? 'bg-geist-success text-white' : ''}
        ${isError    ? 'bg-geist-error text-white' : ''}
        ${!isLoading && !isSuccess && !isError ? 'bg-white text-black hover:bg-white/90 active:bg-white/80' : ''}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading && (
          <motion.div key="spin"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"
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
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
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

// ── Control Pad 2×2 ─────────────────────────────────────────────────────────
const PAD_ACTIONS = [
  { icon: Mic,      label: 'Parla' },
  { icon: Camera,   label: 'Cattura' },
  { icon: Ear,      label: 'Ascolta' },
  { icon: PhoneOff, label: 'Chiudi' },
]

function ControlPad() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PAD_ACTIONS.map(({ icon: Icon, label }) => (
        <button
          key={label}
          className="flex items-center justify-center gap-2
            py-3 rounded-geist
            border border-[#2a2a2a] text-geist-gray-600
            hover:border-[#444] hover:text-geist-gray-400
            active:bg-white/[0.03]
            text-xs font-medium tracking-wide
            transition-all duration-150"
        >
          <Icon size={14} strokeWidth={1.5} />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── PTZ Presets ──────────────────────────────────────────────────────────────
function PtzRow({ presets, currentPreset, onPresetChange, loading }) {
  if (!presets.length) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
      <span className="text-[9px] font-mono text-geist-gray-800 uppercase tracking-widest shrink-0">PTZ</span>
      {presets.map(({ name, token }) => {
        const active  = token === currentPreset
        const moving  = token === loading
        return (
          <motion.button
            key={token}
            whileTap={{ scale: 0.94 }}
            onClick={() => onPresetChange(token)}
            disabled={!!loading}
            className={`
              shrink-0 flex items-center gap-1.5
              px-3 py-1 rounded-[4px] text-[11px] font-medium
              border transition-all duration-150
              ${active
                ? 'border-white/40 bg-white/10 text-white'
                : 'border-[#2a2a2a] text-geist-gray-700 hover:border-[#444] hover:text-geist-gray-500'}
            `}
          >
            {moving && (
              <span className="w-2 h-2 rounded-full border border-white/20 border-t-white/80 animate-spin inline-block" />
            )}
            {name}
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Main View ────────────────────────────────────────────────────────────────
export default function SentinelView({
  status, streamUrls, currentPreset, presets,
  gateState, onOpenGate, onPresetChange, ptzLoading,
}) {
  const isRinging = status === 'ringing'

  return (
    <div className="flex flex-col flex-1 bg-black text-white overflow-y-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-[11px] font-bold tracking-geist uppercase text-geist-gray-700">
          Sentinel
        </h1>
        <div className="flex items-center gap-2">
          {isRinging ? (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-1.5 bg-red-600/15 border border-red-600/30 px-2.5 py-1 rounded-[4px]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-mono font-semibold text-red-400 tracking-widest uppercase">Suona</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-geist-gray-800" />
              <span className="text-[10px] font-mono text-geist-gray-800 tracking-widest uppercase">Idle</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-24">

        {/* Video */}
        <VideoCard streamUrls={streamUrls} status={status} dark />

        {/* PTZ */}
        <PtzRow
          presets={presets}
          currentPreset={currentPreset}
          onPresetChange={onPresetChange}
          loading={ptzLoading}
        />

        {/* Divider */}
        <div className="border-t border-[#1a1a1a]" />

        {/* Gate */}
        <GateBtn state={gateState} onClick={onOpenGate} />

        {/* Control pad */}
        <ControlPad />

      </div>
    </div>
  )
}
