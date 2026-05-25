import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hirek.hangnem.cc',
  server: {
    allowedHosts: ['kod-mac'],
  },
  integrations: [tailwind(), sitemap()],
});