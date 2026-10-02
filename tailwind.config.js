const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
// Basada en la paleta "Shu no Michi" de la app web (src/index.css allá), con grises neutros.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Los tonos que cambian entre modo claro y oscuro son variables: los valores de cada modo
      // están en src/lib/theme.ts. `shu` es el color de la app que se elige en Ajustes: todos sus
      // tonos son variables. Los 500 de gold/moss/kurenai y `washi` (texto sobre fondos de color)
      // son fijos.
      colors: {
        ink: {
          100: themed('ink-100'),
          200: themed('ink-200'),
          300: themed('ink-300'),
          400: themed('ink-400'),
          500: themed('ink-500'),
          600: themed('ink-600'),
          700: themed('ink-700'),
          800: themed('ink-800'),
          900: themed('ink-900'),
          950: themed('ink-950'),
        },
        shu: { 300: themed('shu-300'), 400: themed('shu-400'), 500: themed('shu-500'), 600: themed('shu-600') },
        gold: { 300: themed('gold-300'), 400: themed('gold-400'), 500: '#b8934b' },
        moss: { 300: themed('moss-300'), 400: themed('moss-400'), 500: '#4c7a52' },
        kurenai: { 300: themed('kurenai-300'), 400: themed('kurenai-400'), 500: '#7a3226' },
        washi: '#fafafa',
      },
    },
  },
  plugins: [],
};
