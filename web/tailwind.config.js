/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        burgundy: {
          50: '#fdf2f4',
          100: '#fbe4e8',
          500: '#b83247',
          600: '#9c2538',
          700: '#7a1b2c',
        },
      },
    },
  },
  plugins: [],
};
