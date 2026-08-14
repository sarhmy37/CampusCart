/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#3390fd',
          600: '#1c6ff2',
          700: '#1859de',
          800: '#1a49b3',
          900: '#1b418d',
          950: '#152a56',
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
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}