/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slop: {
          dark: '#0f172a',
          card: '#1e293b',
          accent: '#ef4444',
          accentHover: '#dc2626',
        }
      }
    },
  },
  plugins: [],
}
