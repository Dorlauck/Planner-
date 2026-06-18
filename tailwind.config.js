/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sunrise palette: warm dawn tones
        cream: '#FFF8F1',
        peach: {
          50: '#FFF4EB',
          100: '#FFE6D2',
          200: '#FFD0AC',
          300: '#FCB682',
          400: '#F6A55C',
          500: '#EE8B43',
          600: '#DB7330',
        },
        coral: {
          400: '#F38B7A',
          500: '#EE7B6B',
          600: '#E0604E',
        },
        dusk: {
          400: '#9A8FB8',
          500: '#7C6F9E',
          700: '#4A4263',
          900: '#2C2740',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px -12px rgba(120, 80, 40, 0.18)',
        card: '0 4px 20px -8px rgba(120, 80, 40, 0.15)',
      },
      backgroundImage: {
        'sunrise': 'linear-gradient(160deg, #FFF8F1 0%, #FFEAD7 45%, #FFD9C2 100%)',
        'sunrise-warm': 'linear-gradient(135deg, #F6A55C 0%, #EE7B6B 100%)',
      },
    },
  },
  plugins: [],
}
