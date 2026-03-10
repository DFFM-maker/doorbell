import { motion } from 'framer-motion'
import { Shield, Sun, Terminal } from 'lucide-react'

const TABS = [
  { id: 'sentinel',  label: 'Sentinel',  Icon: Shield },
  { id: 'concierge', label: 'Concierge', Icon: Sun },
  { id: 'ops',       label: 'Ops',       Icon: Terminal },
]

export default function BottomNav({ view, onChange, dark = true }) {
  const navBg    = dark ? 'bg-black/90 border-white/[0.06]'   : 'bg-white/90 border-black/[0.06]'
  const inactive = dark ? 'text-geist-gray-700'               : 'text-geist-gray-400'
  const active   = dark ? 'text-white'                        : 'text-black'
  const pill     = dark ? 'bg-white/[0.06]'                   : 'bg-black/[0.06]'

  return (
    <nav className={`
      flex items-center justify-around
      px-2 py-2
      border-t backdrop-blur-xl
      safe-bottom shrink-0
      ${navBg}
    `}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = view === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative flex flex-col items-center gap-1 px-5 py-1.5 rounded-geist
              transition-colors duration-150 min-w-[72px] min-h-[44px] justify-center"
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
              className={`transition-colors duration-150 ${isActive ? active : inactive}`}
            />
            <span className={`text-[9px] font-semibold tracking-[0.06em] uppercase transition-colors duration-150
              ${isActive ? active : inactive}`}>
              {label}
            </span>
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className={`absolute inset-0 rounded-geist ${pill}`}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
