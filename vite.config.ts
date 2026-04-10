import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 — 같은 네트워크에서 접속 가능
    port: 5173,
  },
})
