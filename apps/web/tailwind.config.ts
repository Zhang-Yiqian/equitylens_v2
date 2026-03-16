import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Analytics Dashboard palette (ui-ux-pro-max: "Analytics Dashboard")
        primary: {
          DEFAULT: '#1E40AF',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#D97706',
          foreground: '#FFFFFF',
        },
        background: '#F8FAFC',
        foreground: '#1E3A8A',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1E3A8A',
        },
        muted: {
          DEFAULT: '#E9EEF6',
          foreground: '#64748B',
        },
        border: '#DBEAFE',
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        ring: '#1E40AF',
        // Signal colors for investment ratings
        signal: {
          buy: '#059669',      // emerald-600
          watch: '#D97706',    // amber-600
          avoid: '#DC2626',    // red-600
          bullish: '#059669',
          bearish: '#DC2626',
          neutral: '#64748B',
          skipped: '#94A3B8',
        },
      },
      fontFamily: {
        // Fira Code for data / numbers, Fira Sans for body (ui-ux-pro-max recommendation)
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Fira Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
