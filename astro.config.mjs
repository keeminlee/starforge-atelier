// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://starforge-atelier.online',
  // The Postmark pages now build+serve from the postmark.town root
  // (astro.config.town.mjs); /atelier/postmark/ keeps only a pointer card, and
  // the box 301s the old deep paths. The v1 archive redirect moved with them
  // (it now lives in the town config as /archive/ -> /works/).
});
