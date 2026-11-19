/** Générateurs — équations différentielles linéaires d'ordre 1 et 2 à coefficients constants. */
import { randInt, randNonZero, pick } from '../core/random';
import type { Question } from '../core/schema';
import { combinaisonTex, construireQcm, cleExpr, coefTex, type Generateur } from './outils';

const expTex = (k: number) => `e^{${coefTex(k)}x}`;

/** y' + a y = b avec condition initiale. */
export const edoOrdre1: Generateur = {
  id: 'edo-ordre-1',
  titre: 'EDO d\'ordre 1',
  chapitre: 'equations-differentielles',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    if (difficulte === 1) {
      // y' = k y, y(0) = y0  →  y = y0 e^{kx}
      const k = pick(rng, [2, 3, -2, -3]);
      const y0 = randNonZero(rng, -4, 5);
      const sol = { tex: combinaisonTex([[y0, expTex(k)]]), str: `${y0}*exp(${k}*x)` };
      const enonce = `Résoudre $y' = ${k}y$ avec $y(0) = ${y0}$.`;
      const correction = [
        `Les solutions de $y' = ay$ sont $x \\mapsto Ce^{ax}$, $C \\in \\mathbb{R}$ (ici $a = ${k}$).`,
        `$y(0) = C = ${y0}$.`,
        `Donc $y(x) = ${sol.tex}$.`,
      ];
      const indice = "Les solutions de $y' = ay$ sont de la forme $Ce^{ax}$.";
      if (forme === 'libre') return { id: '', type: 'expression', difficulte, enonce, indice, correction, reponse: sol.str, variables: ['x'] };
      return construireQcm({ difficulte, enonce, indice, correction }, { texte: `$y = ${sol.tex}$`, explication: 'Forme $Ce^{ax}$ et $C = y(0)$.', cle: cleExpr(sol.str) }, [
        { texte: `$y = ${combinaisonTex([[y0, expTex(-k)]])}$`, explication: "Signe de l'exposant faux : $y' = ay$ donne $e^{ax}$.", cle: cleExpr(`${y0}*exp(${-k}*x)`) },
        { texte: `$y = ${combinaisonTex([[1, expTex(k)], [y0 - 1, '']])}$`, explication: 'La constante est un facteur MULTIPLICATIF : $Ce^{ax}$, pas $e^{ax} + C$.', cle: cleExpr(`exp(${k}*x)+${y0 - 1}`) },
        { texte: `$y = ${combinaisonTex([[y0 * k, expTex(k)]])}$`, explication: "La condition porte sur $y(0)$, pas sur $y'(0)$.", cle: cleExpr(`${y0 * k}*exp(${k}*x)`) },
      ]);
    }
    // y' + a y = b, avec b = a·m : solution particulière constante m.
    const a = pick(rng, difficulte === 2 ? [1, 2, 3] : [1, 2, 3, -1, -2]);
    const m = randNonZero(rng, -4, 4);
    let y0 = randInt(rng, -3, 5);
    while (y0 === m || y0 === 0 || y0 === -m) y0 = randInt(rng, -3, 5);
    const b = a * m;
    const solution = (part: number, c: number, k: number) => ({
      tex: combinaisonTex([[part, ''], [c, expTex(k)]]),
      str: `${part} + (${c})*exp(${k}*x)`,
    });
    const sol = solution(m, y0 - m, -a);
    const eq = `${combinaisonTex([[1, "y'"], [a, 'y']])} = ${b}`;
    const enonce = `Résoudre $${eq}$ avec $y(0) = ${y0}$.`;
    const correction = [
      `Équation homogène $y' ${a > 0 ? '+' : '-'} ${coefTex(Math.abs(a))}y = 0$ : solutions $C${expTex(-a)}$.`,
      `Solution particulière constante : $${coefTex(a)}y_p = ${b}$ donc $y_p = ${m}$.`,
      `Solution générale : $y = ${m} + C${expTex(-a)}$. Puis $y(0) = ${m} + C = ${y0}$ donne $C = ${y0 - m}$.`,
      `Donc $y(x) = ${sol.tex}$.`,
    ];
    const indice = "Solution générale = solution particulière (ici une constante) + solutions de l'équation homogène. La condition initiale se traite à la FIN.";
    if (forme === 'libre') return { id: '', type: 'expression', difficulte, enonce, indice, correction, reponse: sol.str, variables: ['x'] };
    const c = (s: { tex: string; str: string }, explication: string) => ({ texte: `$y = ${s.tex}$`, explication, cle: cleExpr(s.str) });
    return construireQcm({ difficulte, enonce, indice, correction }, c(sol, 'Solution particulière + homogène, constante ajustée à la fin.'), [
      c(solution(m, y0 - m, a), `Signe de l'exposant faux : les solutions de $y' + ay = 0$ sont $Ce^{-ax}$.`),
      c(solution(m, y0, -a), "Constante ajustée AVANT d'ajouter la solution particulière : on n'a plus $y(0) = " + y0 + '$.'),
      c(solution(0, y0, -a), 'Oubli de la solution particulière : ce n\'est solution que de l\'équation homogène.'),
      c(solution(-m, y0 + m, -a), `Solution particulière fausse : $y_p = \\frac{b}{a} = ${m}$.`),
    ]);
  },
};

/** y'' + p y' + q y = 0 : forme de la solution générale selon le discriminant. */
export const edoOrdre2: Generateur = {
  id: 'edo-ordre-2',
  titre: 'EDO d\'ordre 2',
  chapitre: 'equations-differentielles',
  formes: ['qcm'],
  generer(rng, difficulte): Question {
    const indice = "Écris l'équation caractéristique $r^2 + pr + q = 0$ et calcule son discriminant.";
    const lm = (k: number) => `\\lambda ${expTex(k)}`;
    const mu = (k: number) => `\\mu ${expTex(k)}`;
    const trig = (al: number, be: number) =>
      `${expTex(al)}\\left(\\lambda\\cos(${coefTex(be)}x) + \\mu\\sin(${coefTex(be)}x)\\right)`;
    const eqTex = (p: number, q: number) => `${combinaisonTex([[1, "y''"], [p, "y'"], [q, 'y']])} = 0`;
    const carTex = (p: number, q: number) => `${combinaisonTex([[1, 'r^2'], [p, 'r'], [q, '']])} = 0`;
    const enonce = (p: number, q: number) =>
      `Quelle est la solution générale réelle de $${eqTex(p, q)}$ ($\\lambda, \\mu \\in \\mathbb{R}$) ?`;

    if (difficulte === 1) {
      let r1 = 0;
      let r2 = 0;
      while (r1 === r2 || r1 === -r2) {
        r1 = randNonZero(rng, -3, 3);
        r2 = randNonZero(rng, -3, 3);
      }
      const p = -(r1 + r2);
      const q = r1 * r2;
      return construireQcm(
        {
          difficulte,
          enonce: enonce(p, q),
          indice,
          correction: [
            `Équation caractéristique : $${carTex(p, q)}$, de discriminant $\\Delta = ${p * p - 4 * q} > 0$.`,
            `Deux racines réelles distinctes : $r_1 = ${r1}$ et $r_2 = ${r2}$.`,
            `Solution générale : $y = ${lm(r1)} + ${mu(r2)}$.`,
          ],
        },
        { texte: `$y = ${lm(r1)} + ${mu(r2)}$`, explication: `Racines réelles $${r1}$ et $${r2}$.` },
        [
          { texte: `$y = ${lm(-r1)} + ${mu(-r2)}$`, explication: `Signes des racines faux : ce sont les racines de $r^2 ${p > 0 ? '-' : '+'} ${Math.abs(p)}r ${q < 0 ? '-' : '+'} ${Math.abs(q)} = 0$.` },
          { texte: `$y = (\\lambda x + \\mu)${expTex(r1)}$`, explication: "Forme du cas racine double, or ici $\\Delta > 0$." },
          { texte: `$y = ${trig(r1, r2)}$`, explication: 'Forme du cas $\\Delta < 0$ (racines complexes), or ici $\\Delta > 0$.' },
        ],
      );
    }
    if (difficulte === 2) {
      const r = randNonZero(rng, -3, 3);
      const p = -2 * r;
      const q = r * r;
      return construireQcm(
        {
          difficulte,
          enonce: enonce(p, q),
          indice,
          correction: [
            `Équation caractéristique : $${carTex(p, q)}$, soit $(r ${r > 0 ? '-' : '+'} ${Math.abs(r)})^2 = 0$ : $\\Delta = 0$.`,
            `Racine double $r_0 = ${r}$.`,
            `Solution générale : $y = (\\lambda x + \\mu)${expTex(r)}$.`,
          ],
        },
        { texte: `$y = (\\lambda x + \\mu)${expTex(r)}$`, explication: `Racine double $${r}$ : on multiplie par un polynôme de degré 1.` },
        [
          { texte: `$y = ${lm(r)}$`, explication: "Il manque une solution : l'espace des solutions est de dimension 2 (il faut aussi $x e^{r_0x}$)." },
          { texte: `$y = (\\lambda x + \\mu)${expTex(-r)}$`, explication: `Signe de la racine faux : $r_0 = -\\frac{p}{2} = ${r}$.` },
          { texte: `$y = ${lm(r)} + ${mu(-r)}$`, explication: `Les racines ne sont pas $\\pm ${Math.abs(r)}$ : il y a une racine double.` },
        ],
      );
    }
    const al = randNonZero(rng, -2, 2);
    let be = randInt(rng, 1, 3);
    while (be === Math.abs(al)) be = randInt(rng, 1, 3);
    const p = -2 * al;
    const q = al * al + be * be;
    return construireQcm(
      {
        difficulte,
        enonce: enonce(p, q),
        indice,
        correction: [
          `Équation caractéristique : $${carTex(p, q)}$, $\\Delta = ${p * p - 4 * q} < 0$.`,
          `Racines complexes conjuguées : $r = ${al} \\pm ${coefTex(be)}i$ (partie réelle $\\alpha = ${al}$, partie imaginaire $\\beta = ${be}$).`,
          `Solution générale réelle : $y = ${trig(al, be)}$.`,
        ],
      },
      { texte: `$y = ${trig(al, be)}$`, explication: `$e^{\\alpha x}(\\lambda\\cos\\beta x + \\mu\\sin\\beta x)$ avec $\\alpha = ${al}$, $\\beta = ${be}$.` },
      [
        { texte: `$y = ${trig(be, al)}$`, explication: 'Parties réelle et imaginaire inversées.' },
        { texte: `$y = ${trig(-al, be)}$`, explication: `Signe de la partie réelle faux : $\\alpha = -\\frac{p}{2} = ${al}$.` },
        { texte: `$y = ${lm(al)} + ${mu(be)}$`, explication: 'Les racines sont complexes : la solution réelle fait intervenir $\\cos$ et $\\sin$.' },
      ],
    );
  },
};
