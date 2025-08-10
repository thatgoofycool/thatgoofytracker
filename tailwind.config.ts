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
      colors: {}
    },
  },
  plugins: [],
}

export default config


