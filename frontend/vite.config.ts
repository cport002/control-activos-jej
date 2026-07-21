import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5190,
    strictPort: false,
    proxy: {
      '/api': { target: 'http://localhost:3004', changeOrigin: true }
    }
  }
})
