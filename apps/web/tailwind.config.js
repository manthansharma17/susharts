/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: {
          50: '#fff8fa',
          100: '#fdeff3',
          200: '#fadde6',
          300: '#f6c3d1',
          400: '#ef9fb5',
          500: '#e57f9b',
          600: '#d05a7a',
          700: '#b44462',
          800: '#8f344d',
        },
        cocoa: {
          300: '#c4a3ab',
          400: '#a8808a',
          500: '#8a616c',
          600: '#704852',
          700: '#5c3743',
          800: '#4a2a35',
          900: '#3a1f28',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'ui-rounded', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 24px -12px rgba(208, 90, 122, 0.35)',
      },
    },
  },
  plugins: [],
};
