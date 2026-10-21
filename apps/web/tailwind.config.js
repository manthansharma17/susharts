/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Token names are shared across every page; the values set the whole look.
        blush: {
          50: '#fffbf9', // page background (warm cream)
          100: '#fdf2ef', // soft blush panels
          200: '#f6e3de', // hairlines, fills
          300: '#eccac4', // borders on white
          400: '#d79b9b', // muted rose
          500: '#bf6f7b', // rose accent
          600: '#9b2c3f', // primary wine (buttons, price)
          700: '#7e1f31', // hover
          800: '#5c1524', // deepest
        },
        cocoa: {
          300: '#c2aaad',
          400: '#9a8185',
          500: '#75595e',
          600: '#584246',
          700: '#3f2c30',
          800: '#2a1c20', // headings
          900: '#1a1013',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        script: ['Parisienne', 'cursive'],
      },
      letterSpacing: {
        eyebrow: '0.22em',
      },
      boxShadow: {
        soft: '0 18px 40px -24px rgba(92, 21, 36, 0.3)',
        lift: '0 26px 60px -30px rgba(92, 21, 36, 0.42)',
      },
    },
  },
  plugins: [],
};
