import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.VITE_DEV_BACKEND || 'http://localhost:3000'

// The app uses same-origin paths (see src/apiBase.js), so dev needs the API and
// the static media directories proxied to the backend.
const proxy = Object.fromEntries(
  ['/api', '/uploads', '/results'].map((route) => [
    route,
    { target: BACKEND, changeOrigin: true },
  ])
)

export default defineConfig({
  plugins: [react()],
  // publicDir previously pointed at the repository root, which served every
  // file in the project over HTTP — including backend/data/portal.db. The
  // design system is now imported from src/styles/vendor instead, so nothing
  // needs to be served statically from outside the frontend.
  publicDir: false,
  server: {
    port: 5173,
    host: true,
    proxy,
  },
})
