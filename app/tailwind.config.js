// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDF8EC', 100: '#FAEDC4', 200: '#F5DB8D', 300: '#EEC24F',
          400: '#E6AB2B', 500: '#D4941C', 600: '#B87515', 700: '#935814',
          800: '#794718', 900: '#663C19', 950: '#4A2B12',
        },
        accent: { 500: '#ff8a34', 600: '#f0701a' },
        gold: {
          50: '#FDF8EC', 100: '#FAEDC4', 200: '#F5DB8D', 300: '#EEC24F',
          400: '#E6AB2B', 500: '#D4941C', 600: '#B87515', 700: '#935814',
          800: '#794718', 900: '#663C19',
        },
        ink: {
          900: '#0d0c0a', 800: '#161411', 700: '#211e19', 600: '#2c2822', 500: '#3a352c',
        },
      },
      fontFamily: {
        sans: ['PlusJakartaSans', 'System'],
      },
    },
  },
  plugins: [],
};