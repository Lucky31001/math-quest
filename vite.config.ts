/// <reference types="vitest" />
import { defineConfig } from 'vite';

// `base` doit correspondre au nom du dépôt GitHub pour GitHub Pages
// (https://<utilisateur>.github.io/math-quest/). En dev, on sert à la racine.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/math-quest/' : '/',
  build: {
    // math.js est volumineux : on isole les bibliothèques pour un meilleur cache navigateur.
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: ['mathjs', 'katex', 'zod'].map((nom) => ({ name: nom, test: new RegExp(`node_modules[\\/]${nom}[\\/]`) })),
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
