/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // 🔴 Cool Red (light mode primary)
        brand: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // 🟠 Warm Amber/Orange (matching accent for red)
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // 🟡 Gold (dark mode primary – unchanged)
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
        // ⚫ Dark mode backgrounds (unchanged)
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
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}