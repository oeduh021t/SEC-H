import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Isso expõe o servidor para a rede externa
    port: 5173,
    watch: {
      usePolling: true, // Garante que o Docker perceba quando você salvar um arquivo
    },
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://api:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
})