import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase/supabase-js') || id.includes('@supabase')) {
              return 'vendor-supabase'
            }

            if (
              id.includes('react-router')
              || id.includes('react-dom')
              || id.includes('/react/')
            ) {
              return 'vendor-react'
            }

            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }

            return 'vendor-misc'
          }

          return undefined
        },
      },
    },
  },
})
