// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  server: false,
  dev: {
    server: false,
    port: 4321,
  },
  staticDir: './public',
  vite: {},
});
