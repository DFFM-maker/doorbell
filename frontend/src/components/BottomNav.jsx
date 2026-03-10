import { motion } from 'framer-motion'
import { Shield, Sun, Terminal } from 'lucide-react'

const TABS = [
  { id: 'sentinel',  label: 'Sentinel',  Icon: Shield },
  { id: 'concierge', label: 'Concierge', Icon: Sun },
  { id: 'ops',       label: 'Ops',       Icon: Terminal },
]

export default function BottomNav({ view, onChange }) {
  return (
    <nav className="
      flex items-center justify-around
      px-2 py-2
      border-t border-white/[0.06]
      bg-black/80 backdrop-blur-xl
      safe-bottom
    ">
      {TABS.map(({ id, label, Icon }) => {
        const active = view === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative flex flex-col items-center gap-1 px-5 py-1.5 rounded-geist
              transition-colors duration-150 min-w-[72px]"
          >
            <Icon
              size={20}
              strokeWidth={active ? 2 : 1.5}
              className={`transition-colors duration-150 ${active ? 'text-white' : 'text-geist-gray-700'}`}
            />
            <span className={`text-[9px] font-semibold tracking-[0.06em] uppercase transition-colors duration-150
              ${active ? 'text-white' : 'text-geist-gray-700'}`}>
              {label}
            </span>
            {active && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 bg-white/[0.06] rounded-geist"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
