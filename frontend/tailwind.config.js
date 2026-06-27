/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
          navy: '#0D1B3E',
          ink: '#0F172A',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          subtle: '#94A3B8',
        },
        line: {
          DEFAULT: '#E2E8F0',
          subtle: '#F1F5F9',
        },
        canvas: {
          DEFAULT: '#FFFFFF',
          alt: '#F8FAFF',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-bebas)', 'Bebas Neue', 'Impact', 'sans-serif'],
        mono: ['var(--font-jbm)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tightish: '-0.02em',
        wider: '0.08em',
        widest2: '0.12em',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(15,23,42,0.04)',
        'card-hover': '0 8px 24px rgba(15,23,42,0.08)',
        'preview': '0 20px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.06)',
        'chip': '0 4px 20px rgba(37,99,235,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'btn-hover': '0 4px 12px rgba(37,99,235,0.30)',
        'focus-ring': '0 0 0 3px #EFF6FF',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
        'progress-fill': 'linear-gradient(90deg, #2563EB 0%, #3B82F6 100%)',
        'hero-mesh':
          'radial-gradient(ellipse 70% 60% at 15% 20%, #DBEAFE 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 85% 80%, #EFF6FF 0%, transparent 65%)',
      },
      animation: {
        'reveal': 'reveal 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'float-chip': 'float-chip 3.5s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        reveal: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'float-chip': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
