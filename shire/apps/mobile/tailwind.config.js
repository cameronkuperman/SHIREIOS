/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        shire: {
          background: '#F2F2F7',
          surface: '#FFFFFF',
          primary: '#1C1C1E',
          secondary: '#8E8E93',
          accent: '#FF385C',
          accentLight: '#FFF0F2',
          border: '#E5E5EA',
          glass: 'rgba(255, 255, 255, 0.75)',
        },
      },
      boxShadow: {
        soft: '0 4px 14px rgba(0, 0, 0, 0.05)',
        float: '0 8px 30px rgba(0, 0, 0, 0.08)',
        subtle: '0 2px 8px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
