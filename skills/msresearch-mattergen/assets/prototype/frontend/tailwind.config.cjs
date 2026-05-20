/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin')

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      // Colors reference CSS custom properties for easy theming
      colors: {
        // Background hierarchy
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',

        // Borders
        border: 'var(--border)',
        'border-bright': 'var(--border-bright)',

        // Text hierarchy
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',

        // Accent
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'accent-glow': 'var(--accent-glow)',

        // Semantic colors
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
      },

      // Font families
      fontFamily: {
        display: ['Lora', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },

      // Border radius
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },

      // Animations
      animation: {
        'card-in': 'cardIn 0.3s ease-out both',
        'tour-card-in': 'tourCardIn 0.25s ease-out',
        shimmer: 'shimmer 1.5s infinite',
        spin: 'spin 0.7s linear infinite',
      },

      keyframes: {
        cardIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        tourCardIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },

      // Transition timing
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
    },
  },
  plugins: [
    // Focus ring utility
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.focus-ring': {
          '&:focus-visible': {
            outline: '2px solid var(--accent)',
            'outline-offset': '2px',
          },
        },
      })
    }),
  ],
}
