/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { resumerChapitre, REQUETE_RESUME } from './src/core/resume.ts';
import { validerCatalogue, validerChapitre, validerContenu, formaterErreurs } from './src/core/validation.ts';

/**
 * Contenu validé AU BUILD (src/core/validation.ts) : un fichier invalide fait
 * échouer `npm run build` et s'affiche en surimpression dans `npm run dev`.
 * L'application reçoit le contenu déjà validé, valeurs par défaut comprises :
 * elle n'embarque pas les schémas du contenu.
 *
 *   /content/catalogue.json            → catalogue validé
 *   /content/<matière>/<chapitre>.json → chapitre complet validé
 *   … .json?resume                     → seulement son résumé (src/core/resume.ts)
 */
function contenu(): Plugin {
  const racine = fileURLToPath(new URL('./content', import.meta.url));
  const lire = async (f: string): Promise<unknown> => JSON.parse(await readFile(f, 'utf8'));
  return {
    name: 'math-quest:contenu',
    enforce: 'pre',
    // Tout le contenu d'un coup : détecte aussi un chapitre défini dans deux fichiers.
    async buildStart() {
      const fichiers: Record<string, unknown> = {};
      for (const d of await readdir(racine, { withFileTypes: true }))
        if (d.isDirectory())
          for (const f of await readdir(join(racine, d.name)))
            if (f.endsWith('.json')) fichiers[`/content/${d.name}/${f}`] = await lire(join(racine, d.name, f));
      const { erreurs } = validerContenu(fichiers, await lire(join(racine, 'catalogue.json')));
      if (erreurs.length) this.error(formaterErreurs(erreurs));
    },
    async load(id) {
      const [chemin, requete] = id.split('?');
      if (!chemin.startsWith(`${racine}/`) || !chemin.endsWith('.json')) return null;
      const relatif = `/content${chemin.slice(racine.length)}`;
      const catalogue = validerCatalogue(await lire(join(racine, 'catalogue.json')));
      if (!catalogue.ok) this.error(formaterErreurs([{ fichier: '/content/catalogue.json', messages: catalogue.messages }]));
      // Sans requête, on renvoie du JSON : le plugin JSON de Vite en fait un module.
      if (relatif === '/content/catalogue.json') return JSON.stringify(catalogue.catalogue);
      if (!/^\/content\/[^/]+\/[^/]+\.json$/.test(relatif)) return null; // schémas JSON pour l'éditeur
      this.addWatchFile(chemin);
      const r = validerChapitre(relatif, await lire(chemin), catalogue.catalogue);
      if (!r.ok) this.error(formaterErreurs([{ fichier: relatif, messages: r.messages }]));
      // Avec « ?resume », le plugin JSON de Vite n'intervient pas : on renvoie un module.
      if (`?${requete}` === REQUETE_RESUME) return `export default ${JSON.stringify(resumerChapitre(r.chapitre))};`;
      return JSON.stringify(r.chapitre);
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/math-quest/' : '/',
  build: {
    // math.js est volumineux : on isole les bibliothèques pour un meilleur cache navigateur.
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: ['mathjs', 'katex', 'zod'].map((nom) => ({ name: nom, test: new RegExp(`node_modules[\\/]${nom}[\\/]`) })),
        },
      },
    },
  },
  plugins: [
    contenu(),
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
