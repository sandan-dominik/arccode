import { defineConfig } from 'vite';

const isolatedBuildRoot = process.env.ARCCODE_VITE_OUTDIR_BASE?.trim();

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: isolatedBuildRoot ? `${isolatedBuildRoot}/build` : undefined,
  },
});
