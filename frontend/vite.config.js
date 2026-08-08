import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // publicDir previously pointed at the repository root, which served every
  // file in the project over HTTP — including backend/data/portal.db. The
  // design system is now imported from src/styles/vendor instead, so nothing
  // needs to be served statically from outside the frontend.
  publicDir: false,
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      // Uploaded footage and detection output are served by the API.
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/results': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
