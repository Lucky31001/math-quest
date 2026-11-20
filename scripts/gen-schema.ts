/**
 * Génère les schémas JSON du contenu à partir des schémas Zod (src/core/schema.ts) :
 *   content/schema.json            → chapitres  ("$schema": "../schema.json")
 *   content/catalogue.schema.json  → catalogue  ("$schema": "./catalogue.schema.json")
 * Ils donnent l'autocomplétion et la validation dans VS Code.
 *
 *   npm run schema
 */
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { CatalogueSchema, ChapitreSchema } from '../src/core/schema';

function ecrire(fichier: string, titre: string, schema: z.ZodType) {
  // io: 'input' décrit ce qu'on ÉCRIT dans le JSON (les champs avec valeur par défaut restent facultatifs).
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const sortie = new URL(`../content/${fichier}`, import.meta.url);
  writeFileSync(sortie, JSON.stringify({ title: titre, ...json }, null, 2) + '\n');
  console.log(`Schéma écrit dans ${sortie.pathname}`);
}

ecrire('schema.json', 'Chapitre Math Quest', ChapitreSchema);
ecrire('catalogue.schema.json', 'Catalogue Math Quest (niveaux et matières)', CatalogueSchema);
