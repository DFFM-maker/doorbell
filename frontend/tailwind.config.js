/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        geist: {
          bg:           '#000000',
          fg:           '#ffffff',
          'gray-50':    '#fafafa',
          'gray-100':   '#f2f2f2',
          'gray-200':   '#ebebeb',
          'gray-300':   '#e2e2e2',
          'gray-400':   '#c8c8c8',
          'gray-500':   '#a8a8a8',
          'gray-600':   '#888888',
          'gray-700':   '#666666',
          'gray-800':   '#444444',
          'gray-900':   '#2a2a2a',
          'gray-1000':  '#1a1a1a',
          error:        '#e00000',
          success:      '#0d9373',
          warning:      '#d97706',
          amber:        '#f59e0b',
          blue:         '#0070f3',
          pink:         '#eb5757',
        },
      },
      boxShadow: {
        'geist-xs': '0 0 0 1px rgba(0,0,0,.06)',
        'geist-sm': '0 0 0 1px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)',
        'geist':    '0 0 0 1px rgba(0,0,0,.08), 0 4px 8px rgba(0,0,0,.08)',
        'geist-md': '0 0 0 1px rgba(0,0,0,.08), 0 8px 20px rgba(0,0,0,.12)',
        'geist-lg': '0 0 0 1px rgba(0,0,0,.08), 0 24px 48px rgba(0,0,0,.18)',
      },
      borderRadius: { geist: '6px' },
      letterSpacing: { geist: '0.2rem' },
      keyframes: {
        'live-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        'noise': {
          '0%':   { backgroundPosition: '0 0' },
          '20%':  { backgroundPosition: '-5% -10%' },
          '40%':  { backgroundPosition: '-15% 5%' },
          '60%':  { backgroundPosition: '7% -25%' },
          '80%':  { backgroundPosition: '-5% 10%' },
          '100%': { backgroundPosition: '0 0' },
        },
        'ring-glow': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
          '50%':     { boxShadow: '0 0 0 4px rgba(239,68,68,0.35)' },
        },
      },
      animation: {
        'live-pulse':  'live-pulse 1.6s ease-in-out infinite',
        'noise':       'noise 0.35s steps(1) infinite',
        'ring-glow':   'ring-glow 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
