/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        ivory: {
          50:  '#FAFAF8',
          100: '#F5F4F0',
          200: '#ECEAE3',
          300: '#D6D3CB',
          400: '#B8B4A8',
        },
        ink: {
          900: '#1A1A1A',
          700: '#3D3D3D',
          600: '#6B6B6B',
          400: '#9B9B9B',
          200: '#D4D4D0',
        },
        gold: {
          50:  '#FDF8EC',
          100: '#F7EAC6',
          400: '#E8C96A',
          DEFAULT: '#C9A84C',
          600: '#A07C28',
          700: '#7A5C18',
        },
        night: {
          950: '#111110',
          900: '#1C1C1A',
          800: '#252523',
          700: '#2E2E2B',
          600: '#3A3A36',
          500: '#4A4A45',
          400: '#5E5E58',
        },
        risk: {
          high:       '#C0392B',
          'high-lt':  '#E74C3C',
          med:        '#D97706',
          'med-lt':   '#F59E0B',
          low:        '#2E7D4F',
          'low-lt':   '#34D399',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
