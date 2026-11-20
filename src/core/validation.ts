/**
 * Validation du contenu (schémas Zod), AU BUILD : utilisée par le plugin Vite
 * « contenu » (vite.config.ts) et par les tests, jamais par l'application dans
 * le navigateur. Un fichier invalide fait échouer `npm run build` et s'affiche
 * en surimpression dans `npm run dev`, avec le chemin du champ fautif.
 */
import { CatalogueSchema, ChapitreSchema, type Catalogue, type Chapitre } from './schema.ts'; // extension : module aussi chargé par vite.config.ts

export interface ErreurContenu {
  fichier: string;
  messages: string[];
}

export interface Contenu {
  catalogue: Catalogue;
  chapitres: Chapitre[];
  erreurs: ErreurContenu[];
}

const messagesZod = (issues: readonly { path: readonly PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.map(String).join('.') || '(racine)'} : ${i.message}`);

/** Catalogue validé (valeurs par défaut appliquées), ou les messages d'erreur. */
export function validerCatalogue(brut: unknown): { ok: true; catalogue: Catalogue } | { ok: false; messages: string[] } {
  const r = CatalogueSchema.safeParse(brut);
  return r.success ? { ok: true, catalogue: r.data } : { ok: false, messages: messagesZod(r.error.issues) };
}

/**
 * Un fichier de chapitre : schéma, matière déclarée dans le catalogue, dossier
 * cohérent avec la matière, identifiants uniques. Renvoie le chapitre avec ses
 * valeurs par défaut (c'est lui qui est servi à l'application).
 */
export function validerChapitre(fichier: string, brut: unknown, catalogue: Catalogue | null): { ok: true; chapitre: Chapitre } | { ok: false; messages: string[] } {
  const r = ChapitreSchema.safeParse(brut);
  if (!r.success) return { ok: false, messages: messagesZod(r.error.issues) };
  const ch = r.data;
  const messages: string[] = [];
  if (catalogue && !catalogue.niveaux.some((n) => n.matieres.some((m) => m.id === ch.monde)))
    messages.push(`matière « ${ch.monde} » absente de content/catalogue.json`);
  if (!fichier.includes(`/${ch.monde}/`)) messages.push(`matière « ${ch.monde} » mais fichier hors du dossier ${ch.monde}/`);
  const ids = [...ch.exercices.map((q) => q.id), ...ch.flashcards.map((f) => f.id)];
  const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (doublons.length) messages.push(`identifiants en double : ${[...new Set(doublons)].join(', ')}`);
  return messages.length ? { ok: false, messages } : { ok: true, chapitre: ch };
}

/** Tout le contenu { chemin: JSON } : chaque fichier, plus les chapitres définis deux fois. */
export function validerContenu(fichiers: Record<string, unknown>, catalogueBrut: unknown): Contenu {
  const erreurs: ErreurContenu[] = [];
  const cat = validerCatalogue(catalogueBrut);
  if (!cat.ok) erreurs.push({ fichier: '/content/catalogue.json', messages: cat.messages });
  const catalogue = cat.ok ? cat.catalogue : { niveaux: [] };

  const chapitres: Chapitre[] = [];
  for (const [fichier, brut] of Object.entries(fichiers)) {
    if (/\/(schema|catalogue|catalogue\.schema)\.json$/.test(fichier)) continue;
    const r = validerChapitre(fichier, brut, cat.ok ? catalogue : null);
    if (!r.ok) erreurs.push({ fichier, messages: r.messages });
    else if (chapitres.some((c) => c.id === r.chapitre.id)) erreurs.push({ fichier, messages: [`chapitre « ${r.chapitre.id} » déjà défini`] });
    else chapitres.push(r.chapitre);
  }
  const matieres = catalogue.niveaux.flatMap((n) => n.matieres.map((m) => m.id));
  const rang = (m: string) => matieres.indexOf(m);
  chapitres.sort((a, b) => (a.monde === b.monde ? a.ordre - b.ordre : rang(a.monde) - rang(b.monde)));
  return { catalogue, chapitres, erreurs };
}

/** Message d'erreur lisible pour la console / la surimpression de Vite. */
export const formaterErreurs = (erreurs: readonly ErreurContenu[]): string =>
  `Contenu invalide :\n${erreurs.map((e) => `  ${e.fichier}\n${e.messages.map((m) => `    - ${m}`).join('\n')}`).join('\n')}`;
