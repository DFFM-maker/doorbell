import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Wifi, Cpu, Thermometer, Clock, Bell, Unlock, Activity } from 'lucide-react'

// ── Event badge ──────────────────────────────────────────────────────────────
const EVENT_STYLES = {
  DOORBELL_RING:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  dot: 'bg-blue-500',           label: 'RING' },
  ACCESS_GRANTED:   { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', dot: 'bg-geist-success',      label: 'ACCESS' },
  MOTION_DETECTED:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-500',          label: 'MOTION' },
  SYSTEM:           { bg: 'bg-geist-gray-50', text: 'text-geist-gray-600', border: 'border-geist-gray-200', dot: 'bg-geist-gray-400', label: 'SYS' },
}

function EventBadge({ type }) {
  const s = EVENT_STYLES[type] ?? EVENT_STYLES.SYSTEM
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Stat block ───────────────────────────────────────────────────────────────
function StatBlock({ icon: Icon, label, value, unit, loading }) {
  return (
    <div className="flex-1 flex flex-col gap-1.5 bg-white border border-geist-gray-200 rounded-geist p-3 shadow-geist-xs">
      <div className="flex items-center gap-1.5 text-geist-gray-500">
        <Icon size={11} strokeWidth={1.5} />
        <span className="text-[9px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <p className="font-mono text-sm font-semibold text-black">
        {loading ? <span className="text-geist-gray-300">—</span> : value}
        {!loading && unit && <span className="text-[10px] font-normal text-geist-gray-500 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

// ── Main View ────────────────────────────────────────────────────────────────
export default function OpsView({ events, status }) {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    const load = () => {
      fetch('/api/v1/system/stats')
        .then(r => r.json())
        .then(d => { setStats(d); setStatsLoading(false) })
        .catch(() => setStatsLoading(false))
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const isOnline = status !== 'offline'

  return (
    <div className="flex flex-col flex-1 bg-geist-gray-50 text-black overflow-y-auto">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-geist-gray-200 bg-geist-gray-50">
        <h1 className="text-[11px] font-bold tracking-geist uppercase text-geist-gray-500">
          Ops
        </h1>
        <span className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold
          ${isOnline ? 'text-geist-success' : 'text-geist-error'}`}>
          <Wifi size={11} strokeWidth={2} />
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Hardware stats */}
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-geist-gray-500 mb-2">
            System Hardware
          </p>
          <div className="flex gap-2">
            <StatBlock icon={Cpu}         label="CPU"    value={stats ? `${stats.cpu_pct}%` : '—'} loading={statsLoading} />
            <StatBlock icon={Thermometer} label="Temp"   value={stats?.temp_c ?? '—'} unit={stats?.temp_c ? '°C' : ''} loading={statsLoading} />
            <StatBlock icon={Clock}       label="Uptime" value={stats?.uptime ?? '—'} loading={statsLoading} />
          </div>
        </div>

        {/* Event log */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-mono uppercase tracking-widest text-geist-gray-500">
              Event Log
            </p>
            <span className="text-[9px] font-mono text-geist-gray-400">{events.length} eventi</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {events.length === 0 && (
              <p className="text-xs text-geist-gray-400 font-mono text-center py-6">
                Nessun evento registrato
              </p>
            )}
            {events.map((ev, i) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i < 3 ? i * 0.04 : 0 }}
                className="flex items-center gap-2.5 bg-white border border-geist-gray-200
                  rounded-geist px-3 py-2.5 shadow-geist-xs"
              >
                <EventBadge type={ev.type} />
                <p className="flex-1 text-xs text-geist-gray-900 truncate">{ev.message}</p>
                <span className="shrink-0 text-[9px] font-mono text-geist-gray-400">
                  {new Date(ev.time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Emergency button */}
        <button className="
          w-full flex items-center justify-center gap-2
          py-3.5 rounded-geist
          bg-[#eb5757]/10 border border-[#eb5757]/30
          text-[#eb5757] font-semibold text-sm
          hover:bg-[#eb5757]/15 active:bg-[#eb5757]/20
          transition-colors duration-150
        ">
          <AlertTriangle size={16} strokeWidth={2} />
          Emergency Lockdown
        </button>

      </div>
    </div>
  )
}
