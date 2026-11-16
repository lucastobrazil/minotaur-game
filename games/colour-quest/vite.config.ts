import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds to one self-contained dist/index.html (Three.js bundled in),
// which is what gets published as the Claude artifact and opened by the tests.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
