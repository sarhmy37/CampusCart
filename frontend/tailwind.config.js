/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        accent: {
          500: '#ff8a34',
          600: '#f0701a',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faedc4',
          200: '#f5db8d',
          300: '#eec24f',
          400: '#e6ab2b',
          500: '#d4941c',
          600: '#b87515',
          700: '#935814',
          800: '#794718',
          900: '#663c19',
        },
        ink: {
          900: '#0d0c0a',
          800: '#161411',
          700: '#211e19',
          600: '#2c2822',
          500: '#3a352c',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%':      { transform: 'scale(1.3)' },
          '28%':      { transform: 'scale(1)' },
          '42%':      { transform: 'scale(1.15)' },
          '70%':      { transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { transform: 'scale(0.85)', opacity: '0.5' },
          '50%':      { transform: 'scale(1.5)', opacity: '0' },
        },
        shimmerSweep: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        heartbeat: 'heartbeat 1.1s ease-in-out infinite',
        glowPulse: 'glowPulse 1.1s ease-out infinite',
        shimmerSweep: 'shimmerSweep 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}