import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isolatedBuildRoot = process.env.ARCCODE_VITE_OUTDIR_BASE?.trim();

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: isolatedBuildRoot ? `${isolatedBuildRoot}/renderer/main_window` : undefined,
  },
});
