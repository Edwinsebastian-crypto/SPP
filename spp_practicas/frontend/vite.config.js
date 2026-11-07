import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/dist/',
  build: {
    outDir: path.resolve(__dirname, '../public/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'login': path.resolve(__dirname, 'src/entries/login.jsx'),
        'register': path.resolve(__dirname, 'src/entries/register.jsx'),
        'evaluacion-estudiante': path.resolve(__dirname, 'src/entries/evaluacion-estudiante.jsx'),
        'evaluacion-tutor': path.resolve(__dirname, 'src/entries/evaluacion-tutor.jsx'),
        'director-reports': path.resolve(__dirname, 'src/entries/director-reports.jsx'),
        'activities-advisor': path.resolve(__dirname, 'src/entries/activities-advisor.jsx')
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
          if (id.includes('components/common/') || id.includes('components\\common\\')) {
            return 'common-ui';
          }
          if (id.includes('src/core/') || id.includes('src\\core\\')) {
            return 'core-shared';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/css': 'http://localhost:3000',
      '/js': 'http://localhost:3000',
      '/img': 'http://localhost:3000',
      '/pages': 'http://localhost:3000'
    }
  }
});
