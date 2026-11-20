/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `base` doit correspondre au nom du dépôt GitHub pour GitHub Pages
// (https://<utilisateur>.github.io/math-quest/). En dev, on sert à la racine ;
// `vite preview` sert le build, donc avec la même base.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/math-quest/' : '/',
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
  plugins: [
    // Application installable et utilisable hors ligne : tout le site est mis en cache
    // (pré-cache Workbox) au premier chargement. Voir src/pwa.ts pour la mise à jour.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false, // déjà couvertes par globPatterns
      manifest: {
        name: 'Math Quest',
        short_name: 'Math Quest',
        description: 'Révision gamifiée pour la prépa intégrée.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#0f1a1f',
        theme_color: '#0f1a1f',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le compilateur C (wccfiles.zip) est inclus : l'atelier marche aussi hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,zip}'],
        // Polices : seulement le woff2 utile (alphabet latin, pas d'italique).
        globIgnores: ['**/nunito-{cyrillic,vietnamese}*', '**/*-italic.woff2'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
