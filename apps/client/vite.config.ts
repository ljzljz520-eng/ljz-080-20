import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 单应用双入口：/admin 为管家 PC 端，/m 为家属 H5 端
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
