/** @type {import('tailwindcss').Config} */
// Misma paleta "Shu no Michi" que la app web (src/index.css allá).
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          100: '#ede3d3',
          200: '#dcd0bc',
          300: '#c4b69c',
          400: '#a6987c',
          500: '#877a61',
          700: '#35291f',
          800: '#2a2118',
          900: '#1f1a16',
          950: '#16120f',
        },
        shu: { 300: '#e08575', 400: '#d3624e', 500: '#bf3b2e', 600: '#a5301f' },
        gold: { 300: '#dcc28a', 400: '#c9a860', 500: '#b8934b' },
        moss: { 300: '#8fb894', 400: '#6b9a72', 500: '#4c7a52' },
        kurenai: { 300: '#c98a7c', 400: '#a85445', 500: '#7a3226' },
      },
    },
  },
  plugins: [],
};
