/**
 * Génère les schémas JSON du contenu à partir des schémas Zod (src/core/schema.ts) :
 *   content/schema.json            → chapitres  ("$schema": "../schema.json")
 *   content/catalogue.schema.json  → catalogue  ("$schema": "./catalogue.schema.json")
 * Ils donnent l'autocomplétion et la validation dans VS Code.
 *
 *   npm run schema
 */
import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CatalogueSchema, ChapitreSchema } from '../src/core/schema';

function ecrire(fichier: string, titre: string, schema: Parameters<typeof zodToJsonSchema>[0], nom: string) {
  const json = zodToJsonSchema(schema, { name: nom, $refStrategy: 'none', errorMessages: true });
  const sortie = new URL(`../content/${fichier}`, import.meta.url);
  writeFileSync(sortie, JSON.stringify({ title: titre, ...json }, null, 2) + '\n');
  console.log(`Schéma écrit dans ${sortie.pathname}`);
}

ecrire('schema.json', 'Chapitre Math Quest', ChapitreSchema, 'Chapitre');
ecrire('catalogue.schema.json', 'Catalogue Math Quest (niveaux et matières)', CatalogueSchema, 'Catalogue');
