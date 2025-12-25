// client/vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // ADD THIS LINE - tells Vite where public folder is
  publicDir: path.resolve(__dirname, '../public'),
  
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          socketio: ['socket.io-client'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['phaser', 'socket.io-client'],
  },
});