/**
 * Génère content/schema.json à partir du schéma Zod (src/core/schema.ts).
 * Chaque fichier de contenu y fait référence ("$schema": "../schema.json"),
 * ce qui donne l'autocomplétion et la validation dans VS Code.
 *
 *   npm run schema
 */
import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChapitreSchema } from '../src/core/schema';

const schema = zodToJsonSchema(ChapitreSchema, {
  name: 'Chapitre',
  $refStrategy: 'none',
  errorMessages: true,
});

const sortie = new URL('../content/schema.json', import.meta.url);
writeFileSync(sortie, JSON.stringify({ title: 'Chapitre Math Quest', ...schema }, null, 2) + '\n');
console.log(`Schéma écrit dans ${sortie.pathname}`);
