/**
 * Générateurs d'informatique : le code C AFFICHÉ dans l'énoncé est compilé
 * par gcc (-Wall -Werror, comme « Essayer dans l'atelier » le complète) et
 * exécuté ; sa sortie doit être la bonne réponse, et aucun distracteur.
 * Listes chaînées : simulation indépendante, écrite ici.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, availableParallelism } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Question } from '../src/core/schema';
import { completerExtrait } from '../src/c/compilateur';
import { GENERATEURS_INFORMATIQUE, divC, modC } from '../src/generators/informatique';
import { graines, toutes, bonne, mauvais } from './outils/generateurs';

const executer = promisify(execFile);
const dossier = mkdtempSync(join(tmpdir(), 'gen-info-'));
const blocC = (enonce: string) => /```c\n([\s\S]+?)\n```/.exec(enonce)![1];
const sansBackticks = (t: string) => t.replace(/`/g, '');

/** Sortie de chaque programme distinct, compilés et exécutés en parallèle. */
async function sorties(programmes: string[]): Promise<Map<string, string>> {
  const uniques = [...new Set(programmes)];
  const res = new Map<string, string>();
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < uniques.length) {
      const k = suivant++;
      const base = join(dossier, `p${k}`);
      writeFileSync(`${base}.c`, completerExtrait(uniques[k]));
      await executer('gcc', ['-std=c11', '-Wall', '-Werror', '-O0', '-o', base, `${base}.c`]);
      res.set(uniques[k], (await executer(base)).stdout);
    }
  };
  await Promise.all(Array.from({ length: Math.max(2, availableParallelism()) }, ouvrier));
  return res;
}

const valeur = (q: Question): string => {
  if (q.type === 'numerique') return String(q.reponse);
  if (q.type === 'qcm') return sansBackticks(bonne(q).texte);
  throw new Error(q.type);
};

describe('générateurs d’informatique (code C compilé par gcc)', () => {
  it('sémantique du C : division tronquée vers zéro, reste du signe du dividende', () => {
    expect([divC(17, 5), modC(17, 5), divC(-17, 5), modC(-17, 5), divC(17, -5), modC(17, -5)]).toEqual([3, 2, -3, -2, -3, 2]);
  });

  it('la sortie du code affiché est la bonne réponse, jamais un distracteur', { timeout: 120_000 }, async () => {
    const questions = GENERATEURS_INFORMATIQUE.filter((g) => g.id !== 'c-listes-operations').flatMap((g) => [
      ...toutes(g.id, 'libre', graines(77, 3331).slice(0, 12)),
      ...toutes(g.id, 'qcm', graines(91, 2711).slice(0, 12)),
    ]);
    const sortieDe = await sorties(questions.map((q) => blocC(q.enonce)));
    const erreurs: string[] = [];
    for (const q of questions) {
      const sortie = sortieDe.get(blocC(q.enonce))!.trim();
      if (sortie !== valeur(q)) erreurs.push(`${q.id} : gcc affiche ${sortie}, réponse ${valeur(q)}\n${blocC(q.enonce)}`);
      if (q.type === 'qcm')
        for (const c of mauvais(q)) if (sansBackticks(c.texte) === sortie) erreurs.push(`${q.id} : le distracteur ${c.texte} est juste`);
    }
    expect(erreurs, erreurs.slice(0, 5).join('\n\n')).toEqual([]);
  });

  it('listes chaînées : la bonne réponse suit les opérations, aucun distracteur', () => {
    for (const q of toutes('c-listes-operations', 'qcm')) {
      if (q.type !== 'qcm') throw new Error();
      // Simulation indépendante : on relit les opérations dans l'énoncé.
      const liste: string[] = [];
      for (const [, quoi, v] of q.enonce.matchAll(/(insérer (\d) en tête|insérer (\d) en queue|supprimer la tête)/g).map((m) => [m[0], m[1], m[2] ?? m[3]] as const)) {
        if (quoi.endsWith('tête') && quoi.startsWith('insérer')) liste.unshift(v);
        else if (quoi.endsWith('queue')) liste.push(v);
        else liste.shift();
      }
      const attendu = liste.length ? liste.join(' → ') : 'la liste vide';
      expect(sansBackticks(bonne(q).texte), q.enonce).toBe(attendu);
      for (const c of mauvais(q)) expect(sansBackticks(c.texte), q.enonce).not.toBe(attendu);
    }
  });
});
