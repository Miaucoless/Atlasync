/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Atlasync cinematic palette
        atlas: {
          bg:        '#050810',
          surface:   '#0d1117',
          glass:     'rgba(255,255,255,0.04)',
          border:    'rgba(255,255,255,0.08)',
          blue:      '#3B82F6',
          cyan:      '#06B6D4',
          purple:    '#8B5CF6',
          pink:      '#EC4899',
          glow:      'rgba(59,130,246,0.4)',
          'text-primary':   '#F8FAFC',
          'text-secondary': '#94A3B8',
          'text-muted':     '#475569',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display',
          'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        glass: '20px',
        heavy: '40px',
      },
      boxShadow: {
        glass:    '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        glow:     '0 0 30px rgba(59,130,246,0.4)',
        'glow-sm':'0 0 15px rgba(59,130,246,0.3)',
        'glow-lg':'0 0 60px rgba(59,130,246,0.5)',
        card:     '0 20px 60px rgba(0,0,0,0.5)',
        'card-hover': '0 30px 80px rgba(0,0,0,0.6)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(59,130,246,0.3)' },
          '50%':      { boxShadow: '0 0 40px rgba(59,130,246,0.8)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'marker-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.5)', opacity: '0.7' },
        },
      },
      animation: {
        float:            'float 6s ease-in-out infinite',
        'pulse-glow':     'pulse-glow 3s ease-in-out infinite',
        'spin-slow':      'spin-slow 20s linear infinite',
        shimmer:          'shimmer 2s linear infinite',
        'slide-up':       'slide-up 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-in':        'fade-in 0.5s ease-out',
        'marker-pulse':   'marker-pulse 2s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-radial':      'radial-gradient(var(--tw-gradient-stops))',
        'gradient-atlas':       'linear-gradient(135deg, #050810 0%, #0d1427 50%, #050810 100%)',
        'gradient-card':        'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        'gradient-blue-purple': 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
        'gradient-cyan-blue':   'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
      },
    },
  },
  plugins: [],
};
