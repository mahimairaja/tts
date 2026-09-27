// @ts-check
// tts.mahimai.ca: a static site rendered from README.md. `npm run sync` parses the README
// into src/data/readme.json before every dev and build run, so the README stays the product.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://tts.mahimai.ca',
  trailingSlash: 'always',
  // Keep source whitespace: compression drops the space between text and a link on the next line.
  compressHTML: false,
  integrations: [react()],
});
