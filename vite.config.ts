import { defineConfig } from 'vitest/config';
import { loadEnv, transformWithOxc, type Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { demoApiPlugin } from './tools/demo-api.ts';

function devLoaderPlugin(): Plugin {
  return {
    name: 'mobin-ai-dev-loader',
    configureServer(server) {
      server.middlewares.use('/embed/v1.js', async (_request, response, next) => {
        try {
          const source = await readFile(new URL('./src/embed/loader.ts', import.meta.url), 'utf8');
          const result = await transformWithOxc(source, 'loader.ts');
          response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(result.code);
        } catch (error) { next(error); }
      });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss(), devLoaderPlugin(), ...(command === 'serve' && loadEnv(mode, process.cwd(), 'VITE_').VITE_DEMO_MODE === 'true' ? [demoApiPlugin()] : [])],
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
