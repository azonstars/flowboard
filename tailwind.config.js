/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary, #cc785c)',
          50:  'var(--primary-50,  #fdf5f2)',
          100: 'var(--primary-100, #f5e6e0)',
          200: 'var(--primary-200, #eac9bc)',
          300: 'var(--primary-300, #dba891)',
          400: 'var(--primary-400, #cc785c)',
          500: 'var(--primary-500, #b5633f)',
          600: 'var(--primary-600, #cc785c)',
          700: 'var(--primary-700, #9e4f2e)',
          800: 'var(--primary-800, #7d3b21)',
          900: 'var(--primary-900, #5c2914)',
        },
      },
    },
  },
  plugins: [],
}
