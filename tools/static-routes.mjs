import { copyFile, mkdir } from 'node:fs/promises';

for (const route of ['embed', 'privacy']) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile('dist/index.html', `dist/${route}/index.html`);
}
await copyFile('dist/index.html', 'dist/404.html');
