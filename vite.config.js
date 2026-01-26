import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Meningkatkan batas peringatan ukuran chunk menjadi 1000kb (1MB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Logika Smart Chunking: Memisahkan library berat agar loading aplikasi lebih instan
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Memisahkan Firebase ke file vendor tersendiri
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            // Memisahkan Icons agar tidak membebani main bundle
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Library lainnya
            return 'vendor-libs';
          }
        }
      }
    }
  }
})