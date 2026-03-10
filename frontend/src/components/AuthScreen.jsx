import { useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

export default function AuthScreen({ onAuth, error }) {
  const [key, setKey]         = useState('')
  const [show, setShow]       = useState(false)
  const [shaking, setShaking] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!key.trim()) return
    onAuth(key.trim())
  }

  // Shake animation triggered by parent via error prop change
  const handleError = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6">

      {/* Logo / Icon */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4 mb-10"
      >
        <div className="w-14 h-14 rounded-[14px] bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <KeyRound size={24} strokeWidth={1.5} className="text-white/70" />
        </div>
        <div className="text-center">
          <h1 className="text-white font-semibold text-lg tracking-tight">Video Citofono</h1>
          <p className="text-geist-gray-600 text-sm mt-1">Inserisci la chiave di accesso</p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full max-w-sm flex flex-col gap-3"
      >
        <motion.div
          animate={error ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Access Key"
            autoComplete="current-password"
            className="
              w-full bg-white/[0.04] border rounded-geist
              px-4 py-3.5 pr-12
              text-white placeholder-geist-gray-700
              font-mono text-sm
              focus:outline-none focus:border-white/30
              transition-colors duration-150
              border-white/10
            "
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-geist-gray-600 hover:text-geist-gray-400 transition-colors"
          >
            {show ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
          </button>
        </motion.div>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[#eb5757] text-xs font-mono text-center"
          >
            Chiave non valida — riprova
          </motion.p>
        )}

        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          disabled={!key.trim()}
          className="
            w-full py-3.5 rounded-geist
            bg-white text-black
            font-semibold text-sm
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-opacity duration-150
          "
        >
          Accedi
        </motion.button>
      </motion.form>

    </div>
  )
}
