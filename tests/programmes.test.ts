/**
 * Exercices « programme » (C) : la solution de référence réussit tous les tests,
 * avec gcc (-Wall -Werror, AddressSanitizer + UBSan : ni fuite ni comportement
 * indéfini) ET avec le compilateur du navigateur (xcc en WebAssembly). Le code
 * de départ compile et échoue à au moins un test (l'exercice n'est pas déjà résolu).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTENU } from './outils/contenu';
import type { Programme } from '../src/core/schema';
import { corriger, memeSortie, type SortieCas } from '../src/core/grading';
import { chargerCompilateur, compiler, executer, type Compilateur } from '../src/c/compilateur';
import { toutVerifier } from './outils/tout-verifier';

const PROGRAMMES = CONTENU.chapitres.flatMap((c) =>
  c.exercices.filter((q): q is Programme => q.type === 'programme').map((q) => ({ ou: `${c.id}/${q.id}`, q })),
);
const source = (q: Programme, code: string) => `${code}\n\n${q.harnais}`;

const dossier = mkdtempSync(join(tmpdir(), 'math-quest-prog-'));
let numero = 0;
/** Compile avec gcc (avertissements = erreurs, sanitizers) ; renvoie l'exécutable. */
function gcc(src: string, sanitizers = true): string {
  const base = join(dossier, `p${numero++}`);
  writeFileSync(`${base}.c`, src);
  const options = sanitizers ? ['-Werror', '-g', '-fsanitize=address,undefined', '-fno-sanitize-recover=all'] : [];
  execFileSync('gcc', ['-std=c11', '-Wall', ...options, '-O0', '-o', base, `${base}.c`, '-lm'], { stdio: 'pipe' });
  return base;
}
const sortiesGcc = (exe: string, q: Programme): SortieCas[] =>
  q.tests.map((t) => ({ sortie: execFileSync(exe, { input: t.entree, encoding: 'utf8' }), code: 0 }));

let xcc: Compilateur;
beforeAll(() => {
  xcc = chargerCompilateur(new Uint8Array(readFileSync('public/compilateur-c/wccfiles.zip')));
});

/** Sorties du programme sur chaque test, avec le compilateur du navigateur. */
function sortiesXcc(src: string, q: Programme): SortieCas[] | { compilation: string } {
  const r = compiler(xcc, src);
  if (!('module' in r)) return { compilation: r.messages };
  return q.tests.map((t) => {
    let sortie = '';
    const e = executer(r.module, { entree: t.entree, sortie: (x) => (sortie += x) });
    return e.etape === 'execution' && e.trop ? { probleme: 'trop-long', sortie } : { sortie, code: e.etape === 'execution' ? e.code : 1 };
  });
}

describe('exercices « programme »', () => {
  it('il y en a dans chaque chapitre d’informatique', () => {
    const chapitres = CONTENU.chapitres.filter((c) => c.monde === 'informatique');
    expect(chapitres.filter((c) => !c.exercices.some((q) => q.type === 'programme')).map((c) => c.id)).toEqual([]);
  });

  it('la solution réussit tous les tests avec gcc (sanitizers) et avec xcc', { timeout: 120_000 }, () =>
    toutVerifier(
      PROGRAMMES.map(({ ou, q }): [string, () => void] => [
        ou,
        () => {
          const sorties = sortiesGcc(gcc(source(q, q.solution)), q);
          q.tests.forEach((t, i) => {
            const { sortie } = sorties[i];
            expect(memeSortie(t.sortie, sortie), `gcc, entrée ${JSON.stringify(t.entree)} : ${JSON.stringify(sortie)}`).toBe(true);
          });
          const x = sortiesXcc(source(q, q.solution), q);
          expect('compilation' in x ? x.compilation : '', 'xcc').toBe('');
          const r = corriger(q, { type: 'programme', execution: { sorties: x as SortieCas[] } });
          expect(r, 'xcc').toMatchObject({ statut: 'correct', testsReussis: q.tests.length });
        },
      ]),
    ));

  // gcc plutôt que xcc ici : xcc (WebAssembly) met ~2 s par compilation sous Node.
  it('le code de départ compile mais ne réussit pas tous les tests', () =>
    toutVerifier(
      PROGRAMMES.map(({ ou, q }): [string, () => void] => [
        ou,
        () => {
          const sorties = sortiesGcc(gcc(source(q, q.code), false), q);
          expect(corriger(q, { type: 'programme', execution: { sorties } }).statut).toBe('incorrect');
        },
      ]),
    ));
});

describe('correction d’un programme', () => {
  const q = PROGRAMMES[0].q;
  it('compare les sorties aux espaces de fin et lignes vides finales près', () => {
    expect(memeSortie('1 2\n3', '1 2   \n3\n\n')).toBe(true);
    expect(memeSortie('1 2', '1  2')).toBe(false);
    expect(memeSortie('', '\n')).toBe(true);
  });
  it('erreur de compilation : réponse invalide (non comptée)', () => {
    expect(corriger(q, { type: 'programme', execution: { compilation: 'erreur' } }).statut).toBe('invalide');
  });
  it('un plantage ou une boucle infinie fait échouer le test', () => {
    const sorties: SortieCas[] = q.tests.map((t) => ({ sortie: t.sortie, code: 0 }));
    expect(corriger(q, { type: 'programme', execution: { sorties } })).toMatchObject({ statut: 'correct' });
    sorties[0] = { probleme: 'temps', sortie: q.tests[0].sortie };
    expect(corriger(q, { type: 'programme', execution: { sorties } })).toMatchObject({ statut: 'incorrect', testsReussis: q.tests.length - 1 });
  });
});
