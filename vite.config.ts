/// <reference types="vitest" />
import { defineConfig } from 'vite';

// `base` doit correspondre au nom du dépôt GitHub pour GitHub Pages
// (https://<utilisateur>.github.io/math-quest/). En dev, on sert à la racine.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/math-quest/' : '/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
