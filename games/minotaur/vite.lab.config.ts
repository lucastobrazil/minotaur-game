import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Character lab: a separate single-file page (dist-lab/lab.html). Not part of the game build.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist-lab', chunkSizeWarningLimit: 2000, rollupOptions: { input: 'lab.html' } },
});
