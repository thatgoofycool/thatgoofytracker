import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './styles/**/*.{ts,tsx,css}',
  ],
  theme: {
    extend: {
      colors: {},
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'ui-sans-serif', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
      }
    },
  },
  plugins: [],
}

export default config


