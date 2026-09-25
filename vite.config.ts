import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { demoApiPlugin } from './tools/demo-api.ts';

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss(), ...(command === 'serve' && loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO_MODE === 'true' ? [demoApiPlugin()] : [])],
  build: {
    rollupOptions: {
      input: { main: 'index.html', loader: 'src/embed/loader.ts' },
      output: {
        entryFileNames: (chunk) => chunk.name === 'loader' ? 'embed/v1.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], exclude: ['tests/browser/**', 'node_modules/**'] },
}));
