// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://starforge-atelier.online',
  redirects: {
    // v1's Town Archive folded into the Works (postmark-v2); old links stay alive
    '/atelier/postmark/archive/': '/atelier/postmark/works/',
  },
});
