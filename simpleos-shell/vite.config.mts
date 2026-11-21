import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base makes the built bundle load correctly from file:// inside
// Electron, not just from a web server.
export default defineConfig({
  base: './',
  plugins: [react()],
})
