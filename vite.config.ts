import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  plugins: [
        sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true
      },
      paths: {
        base: process.env.BASE_PATH
          ? `/${process.env.BASE_PATH.replace(/^\/+|\/+$/g, '')}`
          : ''
      },
      adapter: adapter({
        fallback: '404.html'
      })
    })
  ]
});
