/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        shire: {
          bg: '#1a1a2e',
          surface: '#16213e',
          primary: '#0f3460',
          accent: '#e94560',
          text: '#eaeaea',
          muted: '#8b8b9e',
          success: '#2ecc71',
          warning: '#f39c12',
          danger: '#e74c3c',
        },
      },
    },
  },
  plugins: [],
};
