/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages project sites serve from /<repo-name>/, not /.
// A custom domain (brief section 43L) serves from / instead — override
// with VITE_BASE_PATH=/ at build time when that day comes, no code change needed.
const basePath = process.env.VITE_BASE_PATH ?? '/Kracht-Dashboard/'

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
