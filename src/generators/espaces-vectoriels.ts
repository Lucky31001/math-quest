/** Générateurs — espaces vectoriels (liberté d'une famille, rang). */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { construireQcm, combinaisonTex, type Generateur } from './outils';
import { det3 } from './matrices';

type V3 = [number, number, number];
const vTex = (v: V3) => `(${v.join(',\\ ')})`;
const comb = (a: number, u: V3, b: number, v: V3): V3 => [0, 1, 2].map((k) => a * u[k] + b * v[k]) as V3;
const egaux = (u: V3, v: V3) => u.every((x, k) => x === v[k]);
const colineaires = (u: V3, v: V3) =>
  u[1] * v[2] - u[2] * v[1] === 0 && u[2] * v[0] - u[0] * v[2] === 0 && u[0] * v[1] - u[1] * v[0] === 0;

export const familleLibre: Generateur = {
  id: 'ev-famille-libre',
  titre: 'Famille libre ou liée',
  chapitre: 'espaces-vectoriels',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const R = difficulte === 1 ? 2 : 3;
    const rv = (): V3 => [randInt(rng, -R, R), randInt(rng, -R, R), randInt(rng, -R, R)];
    let v1: V3, v2: V3;
    do {
      v1 = rv();
      v2 = rv();
    } while (colineaires(v1, v2) || v1.every((x) => x === 0));
    const liee = pick(rng, [true, false]);
    const alpha = randNonZero(rng, -2, 2);
    const beta = randNonZero(rng, -2, 2);
    let v3: V3;
    if (liee) v3 = comb(alpha, v1, beta, v2);
    else
      do v3 = rv();
      while (det3([v1, v2, v3]) === 0);
    const D = det3([v1, v2, v3]);
    const rang = D !== 0 ? 3 : 2;
    const relation = (a: number, b: number) => `$v_3 = ${combinaisonTex([[a, 'v_1'], [b, 'v_2']])}$`;
    const famille = `$v_1 = ${vTex(v1)}$, $v_2 = ${vTex(v2)}$, $v_3 = ${vTex(v3)}$`;
    const correction = [
      `$v_1$ et $v_2$ ne sont pas colinéaires, donc $\\mathrm{Vect}(v_1, v_2)$ est de dimension 2.`,
      `On calcule $\\det(v_1, v_2, v_3) = ${D}$.`,
      D !== 0
        ? 'Le déterminant est non nul : la famille est libre, et 3 vecteurs libres de $\\mathbb{R}^3$ (dimension 3) forment une base.'
        : `Le déterminant est nul : la famille est liée. On trouve en effet ${relation(alpha, beta)}.`,
      `Le rang de la famille vaut donc $${rang}$.`,
    ];
    const indice = 'Calcule le déterminant des trois vecteurs (ou cherche une relation $v_3 = \\alpha v_1 + \\beta v_2$).';

    if (forme === 'libre')
      return {
        id: '',
        type: 'numerique',
        difficulte,
        enonce: `Dans $\\mathbb{R}^3$, soit ${famille}. Quelle est la dimension de $\\mathrm{Vect}(v_1, v_2, v_3)$ ?`,
        indice,
        correction,
        reponse: rang,
      };

    // Fausse relation : vérifiée fausse avant d'être proposée.
    let fa = alpha;
    let fb = -beta;
    if (egaux(comb(fa, v1, fb, v2), v3)) [fa, fb] = [beta, alpha];
    if (egaux(comb(fa, v1, fb, v2), v3)) [fa, fb] = [alpha + 1, beta];
    const fausse = { texte: `Liée : ${relation(fa, fb)}`, explication: `Relation fausse : $${combinaisonTex([[fa, 'v_1'], [fb, 'v_2']])} = ${vTex(comb(fa, v1, fb, v2))} \\neq v_3$.` };
    const base = { difficulte, enonce: `Dans $\\mathbb{R}^3$, soit ${famille}. Que dire de la famille $(v_1, v_2, v_3)$ ?`, indice, correction };
    const pasGeneratrice = {
      texte: 'Libre, mais pas génératrice de $\\mathbb{R}^3$',
      explication: 'Impossible : en dimension 3, une famille libre de 3 vecteurs est automatiquement une base (donc génératrice).',
    };
    if (liee)
      return construireQcm(base, { texte: `Liée : ${relation(alpha, beta)}`, explication: `On vérifie : $${combinaisonTex([[alpha, 'v_1'], [beta, 'v_2']])} = ${vTex(v3)}$.` }, [
        { texte: 'Libre : c\'est une base de $\\mathbb{R}^3$', explication: 'Non : $\\det(v_1,v_2,v_3) = 0$, la famille est liée.' },
        fausse,
        pasGeneratrice,
      ]);
    return construireQcm(base, { texte: "Libre : c'est une base de $\\mathbb{R}^3$", explication: `$\\det(v_1, v_2, v_3) = ${D} \\neq 0$.` }, [
      fausse,
      pasGeneratrice,
      { texte: 'Liée, car $v_3$ n\'est pas colinéaire à $v_1$', explication: 'Être non colinéaire à $v_1$ ne dit rien sur la liberté de la famille entière. Ici le déterminant est non nul : elle est libre.' },
    ]);
  },
};
