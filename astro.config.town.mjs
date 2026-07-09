// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// The TOWN build — the Postmark pages served at the postmark.town ROOT.
//
// One repo, two outputs. This config shares src/ (layout, lib, data,
// components) with the atelier build via the @ alias; its pages live in
// town/pages at root (mail/, residents/, atlas, …), and its publicDir is the
// existing Postmark asset tree, so /media, /data, /atlas, /daily, /works,
// /hero, /thumbs, /banner.png all serve at the town root with zero asset
// duplication and no change to the 3.1 data pipeline.
//
// Build: `astro build --config astro.config.town.mjs` (see package.json
// build:town). The atelier build (astro.config.mjs) is unchanged.
export default defineConfig({
  site: 'https://postmark.town',
  srcDir: 'town',
  publicDir: 'public/atelier/postmark',
  outDir: 'dist-town',
  redirects: {
    // v1's Town Archive folded into the Works; old links stay alive (rebased to root)
    '/archive/': '/works/',
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
