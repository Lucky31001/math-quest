/**
 * Compilation et exécution de C dans le navigateur, sans serveur.
 *
 * Le compilateur est xcc (https://github.com/tyfkda/xcc, licence MIT) : un vrai
 * compilateur C, lui-même compilé en WebAssembly, qui produit du WebAssembly.
 * Ses fichiers (public/compilateur-c/wccfiles.zip : `cc`, en-têtes, libc) sont
 * chargés une fois, puis compilation et exécution tournent dans `wasi.ts`.
 * Ce module ne touche pas au DOM : il sert au Web Worker et aux tests.
 */
import { unzipSync } from 'fflate';
import { executerWasi, SystemeFichiers, SortieTropLongue, type Octets } from './wasi';
import { utiliseScanf, SOURCE_SCANF, FICHIER_SCANF, DEFINITIONS_SCANF } from './scanf';

const DOSSIER = '/home/eleve';
const ENV = { HOME: DOSSIER, PWD: DOSSIER, INCLUDE: '/usr/include', LIB: '/usr/lib', PATH: '/usr/bin', USER: 'eleve' };

export interface Compilateur {
  /** Fichiers du compilateur (cc, en-têtes, bibliothèques). */
  base: SystemeFichiers;
  cc: WebAssembly.Module;
}

/** Prépare le compilateur à partir du contenu de wccfiles.zip. */
export function chargerCompilateur(zip: Uint8Array): Compilateur {
  const base = new SystemeFichiers();
  for (const [nom, contenu] of Object.entries(unzipSync(zip))) {
    if (nom.endsWith('/')) base.creerDossier(`/${nom}`);
    // fflate alloue chaque fichier dans un ArrayBuffer neuf (jamais partagé).
    else base.ecrire(`/${nom}`, contenu as Octets);
  }
  const binaire = base.lire('/usr/bin/cc');
  if (!binaire) throw new Error('compilateur introuvable dans wccfiles.zip');
  base.creerDossier(DOSSIER);
  base.creerDossier('/tmp');
  return { base, cc: new WebAssembly.Module(binaire) };
}

export type Resultat =
  | { etape: 'compilation'; code: number; messages: string }
  | { etape: 'execution'; code: number; trop: boolean };

export interface OptionsExecution {
  /** Entrée standard (pour scanf). */
  entree?: string;
  /** Sortie du programme, au fil de l'eau. */
  sortie?: (texte: string, fd: 1 | 2) => void;
  limiteSortie?: number;
}

/** Compile `source` ; renvoie le module WebAssembly obtenu ou les messages d'erreur. */
export function compiler(c: Compilateur, source: string): { module: WebAssembly.Module } | { code: number; messages: string } {
  const fs = c.base.copier();
  fs.ecrire(`${DOSSIER}/main.c`, source);
  // scanf de la bibliothèque de xcc défaillant : on compile le nôtre avec (voir scanf.ts).
  const scanf = utiliseScanf(source);
  if (scanf) fs.ecrire(`${DOSSIER}/${FICHIER_SCANF}`, SOURCE_SCANF);
  let messages = '';
  const code = executerWasi(c.cc, {
    args: ['cc', ...(scanf ? DEFINITIONS_SCANF : []), '-o', 'main.wasm', 'main.c', ...(scanf ? [FICHIER_SCANF] : [])],
    env: ENV,
    fs,
    dossierCourant: DOSSIER,
    sortie: (t) => (messages += t),
  });
  const binaire = fs.lire(`${DOSSIER}/main.wasm`);
  if (code !== 0 || !binaire) return { code: code || 1, messages: messages || 'La compilation a échoué.' };
  return { module: new WebAssembly.Module(binaire) };
}

/** Exécute un programme compilé, dans un système de fichiers vierge. */
export function executer(module: WebAssembly.Module, options: OptionsExecution = {}): Resultat {
  const fs = new SystemeFichiers();
  fs.creerDossier(DOSSIER);
  try {
    const code = executerWasi(module, {
      args: ['main'],
      env: ENV,
      fs,
      dossierCourant: DOSSIER,
      entree: options.entree,
      sortie: options.sortie,
      limiteSortie: options.limiteSortie,
    });
    return { etape: 'execution', code, trop: false };
  } catch (e) {
    if (e instanceof SortieTropLongue) return { etape: 'execution', code: -1, trop: true };
    throw e;
  }
}

/** Compile puis exécute `source`. */
export function compilerEtExecuter(c: Compilateur, source: string, options: OptionsExecution = {}): Resultat {
  const r = compiler(c, source);
  return 'module' in r ? executer(r.module, options) : { etape: 'compilation', ...r };
}

const INCLUDES = ['stdio.h', 'stdlib.h', 'string.h'];

/** Début d'une définition de niveau fichier : `typedef`, `struct X {`, ou `type nom(...) {`. */
// Les mots-clés de contrôle (`else if (…)`, `while (…)`…) ressemblent à `type nom(…)` : on les exclut.
const DEBUT_DEFINITION = /^(?!(?:if|else|while|for|switch|do|return)\b)(typedef\b|struct\s+\w+\s*\{|[A-Za-z_][\w\s*]*\b\w+\s*\([^;{}]*\)\s*\{?\s*$)/;

/** Sépare un extrait en définitions (niveau fichier) et instructions (à placer dans `main`). */
function separer(code: string): { definitions: string[]; instructions: string[] } {
  const definitions: string[] = [];
  const instructions: string[] = [];
  const lignes = code.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    if (!DEBUT_DEFINITION.test(lignes[i]) || /^\s/.test(lignes[i])) {
      instructions.push(lignes[i]);
      continue;
    }
    // On avance jusqu'à l'équilibre des accolades, puis (typedef, struct) jusqu'au « ; » final.
    const bloc: string[] = [];
    let profondeur = 0;
    let ouvert = false;
    for (; i < lignes.length; i++) {
      const l = lignes[i];
      bloc.push(l);
      for (const ch of l) {
        if (ch === '{') (profondeur++, (ouvert = true));
        else if (ch === '}') profondeur--;
      }
      const fin = ouvert && profondeur === 0 && (/^(typedef|struct)/.test(bloc[0]) ? /;\s*$/.test(l) : true);
      if (fin || (!ouvert && /;\s*$/.test(l))) break;
    }
    definitions.push(bloc.join('\n'));
  }
  return { definitions, instructions };
}

/** Noms de types définis par `typedef … Nom;` dans un code. */
const typesDefinis = (code: string): string[] => [...code.matchAll(/typedef[\s\S]*?\}\s*(\w+)\s*;|typedef\s+[^{};]*\b(\w+)\s*;/g)].map((m) => m[1] ?? m[2]);

/**
 * Complète un extrait de cours en programme compilable :
 * - ajoute les `#include` usuels absents ;
 * - reprend dans `precedents` (blocs précédents du même cours) les `typedef` utilisés mais non définis ;
 * - s'il n'y a pas de `main`, place les instructions dans un `main` (les définitions restent au niveau du fichier).
 */
export function completerExtrait(code: string, precedents: string[] = []): string {
  let texte = code.replace(/\s+$/, '');
  const definis = new Set(typesDefinis(texte));
  const ajouts: string[] = [];
  for (const p of precedents)
    for (const nom of typesDefinis(p))
      if (!definis.has(nom) && new RegExp(`\\b${nom}\\b`).test(texte) && !ajouts.includes(p)) {
        ajouts.push(...separer(p).definitions.filter((d) => d.startsWith('typedef') || d.startsWith('struct')));
        definis.add(nom);
      }
  if (ajouts.length) texte = `${ajouts.join('\n\n')}\n\n${texte}`;
  const entetes = INCLUDES.filter((h) => !texte.includes(`<${h}>`))
    .map((h) => `#include <${h}>`)
    .join('\n');
  const debut = entetes ? `${entetes}\n\n` : '';
  if (/\bmain\s*\(/.test(texte)) return `${debut}${texte}\n`;
  const { definitions, instructions } = separer(texte);
  const corps = instructions.join('\n').trim()
    ? instructions.map((l) => (l ? `    ${l}` : l)).join('\n').replace(/^\n+|\n+$/g, '')
    : '    /* Appelle tes fonctions ici. */';
  const defs = definitions.length ? `${definitions.join('\n\n')}\n\n` : '';
  return `${debut}${defs}int main(void) {\n${corps}\n    return 0;\n}\n`;
}
