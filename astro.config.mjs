import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

export default defineConfig({
  server: {
    allowedHosts: ['kod-mac'],
  },

  integrations: [tailwind()],
});