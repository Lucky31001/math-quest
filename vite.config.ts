/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFile } from 'node:fs/promises';
import { resumerChapitre, REQUETE_RESUME } from './src/core/resume';

/**
 * `import x from '/content/m/chapitre.json?resume'` → seulement le résumé du chapitre
 * (src/core/resume.ts), sous forme de module JS (le plugin JSON de Vite ignore les requêtes « ? »).
 */
function resumeChapitres(): Plugin {
  return {
    name: 'math-quest:resume-chapitres',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(`.json${REQUETE_RESUME}`)) return null;
      const fichier = id.slice(0, -REQUETE_RESUME.length);
      this.addWatchFile(fichier);
      return `export default ${JSON.stringify(resumerChapitre(JSON.parse(await readFile(fichier, 'utf8'))))};`;
    },
  };
}

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
    resumeChapitres(),
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
