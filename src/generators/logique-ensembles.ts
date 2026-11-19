/** Générateurs — logique (tables de vérité, négations) et ensembles (dénombrement). */
import { randInt, pick, shuffle, type Rng } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import { construireQcm, cleNum, fact, binom, type Generateur, type Candidat } from './outils';

/* ------------------------------------------------------------------ */
/* Tables de vérité                                                    */
/* ------------------------------------------------------------------ */

type Op = 'et' | 'ou' | 'imp' | 'eq';
export type Formule = { t: 'v'; n: string } | { t: 'non'; a: Formule } | { t: Op; a: Formule; b: Formule };

const SYMBOLE: Record<Op, string> = { et: '\\land', ou: '\\lor', imp: '\\Rightarrow', eq: '\\Leftrightarrow' };

/** LaTeX, sous-formules binaires toujours parenthésées (pas d'ambiguïté de priorité). */
export function formuleTex(f: Formule, racine = true): string {
  if (f.t === 'v') return f.n;
  if (f.t === 'non') return `\\neg ${formuleTex(f.a, false)}`;
  const s = `${formuleTex(f.a, false)} ${SYMBOLE[f.t]} ${formuleTex(f.b, false)}`;
  return racine ? s : `(${s})`;
}

export function evaluer(f: Formule, env: Record<string, boolean>): boolean {
  switch (f.t) {
    case 'v':
      return env[f.n];
    case 'non':
      return !evaluer(f.a, env);
    case 'et':
      return evaluer(f.a, env) && evaluer(f.b, env);
    case 'ou':
      return evaluer(f.a, env) || evaluer(f.b, env);
    case 'imp':
      return !evaluer(f.a, env) || evaluer(f.b, env);
    case 'eq':
      return evaluer(f.a, env) === evaluer(f.b, env);
  }
}

function tirerFormule(rng: Rng, d: Difficulte): { f: Formule; vars: string[] } {
  const lit = (n: string): Formule => (rng() < 0.35 ? { t: 'non', a: { t: 'v', n } } : { t: 'v', n });
  const op = (liste: Op[]) => pick(rng, liste);
  if (d === 1) return { f: { t: op(['et', 'ou', 'imp']), a: lit('P'), b: lit('Q') }, vars: ['P', 'Q'] };
  if (d === 2) {
    const interne: Formule = { t: op(['et', 'ou', 'imp']), a: lit('P'), b: lit('Q') };
    const f: Formule = rng() < 0.3 ? { t: op(['et', 'ou', 'imp', 'eq']), a: { t: 'non', a: interne }, b: lit('P') } : { t: op(['et', 'ou', 'imp', 'eq']), a: interne, b: lit(pick(rng, ['P', 'Q'])) };
    return { f, vars: ['P', 'Q'] };
  }
  const [x, y, z] = shuffle(['P', 'Q', 'R'], rng);
  return { f: { t: op(['et', 'ou', 'imp', 'eq']), a: { t: op(['et', 'ou', 'imp']), a: lit(x), b: lit(y) }, b: lit(z) }, vars: ['P', 'Q', 'R'] };
}

export const tableVerite: Generateur = {
  id: 'logique-table-verite',
  titre: 'Tables de vérité',
  chapitre: 'logique',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const { f, vars } = tirerFormule(rng, difficulte);
    const lignes: Record<string, boolean>[] = [];
    for (let m = 0; m < 2 ** vars.length; m++) lignes.push(Object.fromEntries(vars.map((v, i) => [v, !((m >> (vars.length - 1 - i)) & 1)])));
    const vraies = lignes.filter((env) => evaluer(f, env));
    const total = lignes.length;
    const c = vraies.length;
    const ligneTex = (env: Record<string, boolean>) => `(${vars.map((v) => (env[v] ? 'V' : 'F')).join(', ')})`;
    const enonce = `Dans la table de vérité de $${formuleTex(f)}$ (${total} lignes, selon les valeurs de ${vars.join(', ')}), combien de lignes donnent VRAI ?`;
    const correction = [
      'Rappels : $A \\Rightarrow B$ est fausse seulement si $A$ est vraie et $B$ fausse ; $A \\Leftrightarrow B$ est vraie si $A$ et $B$ ont la même valeur.',
      `On évalue les ${total} lignes $(${vars.join(', ')})$.`,
      c ? `Lignes vraies : ${vraies.map(ligneTex).join(', ')}.` : 'Aucune ligne n\'est vraie : la formule est une contradiction.',
      `Il y a donc ${c} ligne(s) vraie(s).`,
    ];
    const indice = 'Écris la table colonne par colonne : d\'abord les sous-formules entre parenthèses.';
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: c };
    const cand = (v: number, explication: string): Candidat => ({ texte: `$${v}$`, explication, cle: cleNum(v) });
    const distr = [
      cand(total - c, 'Tu as compté les lignes FAUSSES.'),
      cand(c + 1, "Une ligne mal évaluée : souvent $F \\Rightarrow F$, qui est VRAIE."),
      cand(c - 1, 'Une ligne vraie oubliée : vérifie les lignes où la prémisse est fausse.'),
      cand(c + 2, 'Plusieurs lignes mal évaluées.'),
      cand(c - 2, 'Plusieurs lignes vraies oubliées.'),
    ].filter((x) => {
      const v = Number(x.texte.slice(1, -1));
      return v >= 0 && v <= total;
    });
    return construireQcm({ difficulte, enonce, indice, correction }, cand(c, 'Comptage ligne par ligne.'), distr);
  },
};

/* ------------------------------------------------------------------ */
/* Négation d'énoncés quantifiés                                       */
/* ------------------------------------------------------------------ */

type Quant = '\\forall' | '\\exists';

interface Predicat {
  p: string;
  /** négation correcte */
  n: string;
  /** négation fautive classique + explication */
  w: string;
  pourquoi: string;
  /** Quantificateurs autorisés (2 variables) : ceux qui donnent une phrase non triviale. */
  prefixes?: [Quant, Quant][];
}

const PRED1: Predicat[] = [
  { p: 'f(x) > 0', n: 'f(x) \\leq 0', w: 'f(x) < 0', pourquoi: 'La négation de $>$ est $\\leq$ (le cas d\'égalité est oublié).' },
  { p: 'f(x) \\geq x', n: 'f(x) < x', w: 'f(x) \\leq x', pourquoi: 'La négation de $\\geq$ est $<$, pas $\\leq$.' },
  { p: 'f(x) = 0', n: 'f(x) \\neq 0', w: 'f(x) > 0', pourquoi: 'La négation de $=$ est $\\neq$ : $f(x)$ peut aussi être négatif.' },
  { p: 'f(x) \\leq 1', n: 'f(x) > 1', w: 'f(x) \\geq 1', pourquoi: 'La négation de $\\leq$ est $>$.' },
];
const PRED1_IMP: Predicat[] = [
  { p: 'x > 0 \\Rightarrow f(x) > 0', n: 'x > 0 \\text{ et } f(x) \\leq 0', w: 'x \\leq 0 \\Rightarrow f(x) \\leq 0', pourquoi: '$\\text{non}(A \\Rightarrow B) \\equiv A \\text{ et non } B$ : ce n\'est pas une implication.' },
  { p: 'f(x) = 0 \\Rightarrow x = 1', n: 'f(x) = 0 \\text{ et } x \\neq 1', w: 'f(x) \\neq 0 \\Rightarrow x \\neq 1', pourquoi: '$\\text{non}(A \\Rightarrow B) \\equiv A \\text{ et non } B$ : ce n\'est pas une implication.' },
];
// Prédicats ne portant que sur f(x) et f(y), non symétriques : avec une variable « libre »
// comme y > x, certaines phrases deviennent toujours vraies/fausses sur ℝ et un distracteur
// pourrait se retrouver équivalent à la bonne réponse.
const PRED2: Predicat[] = [
  // ∃x ∀y : « f admet un minimum » ; ∀x ∀y : « f est constante »
  { p: 'f(x) \\leq f(y)', n: 'f(x) > f(y)', w: 'f(x) \\geq f(y)', pourquoi: 'La négation de $\\leq$ est $>$.', prefixes: [['\\exists', '\\forall'], ['\\forall', '\\forall']] },
  // ∀x ∃y : « f n'a pas de maximum » ; ∃x ∃y : « f n'est pas constante »
  { p: 'f(x) < f(y)', n: 'f(x) \\geq f(y)', w: 'f(x) > f(y)', pourquoi: 'La négation de $<$ est $\\geq$.', prefixes: [['\\forall', '\\exists'], ['\\exists', '\\exists']] },
  // ∀x ∃y et ∃x ∃y : « f n'est pas constante »
  { p: 'f(x) \\neq f(y)', n: 'f(x) = f(y)', w: 'f(x) < f(y)', pourquoi: 'La négation de $\\neq$ est $=$.', prefixes: [['\\forall', '\\exists'], ['\\exists', '\\exists']] },
];
const PRED2_IMP: Predicat[] = [
  { p: 'x < y \\Rightarrow f(x) < f(y)', n: 'x < y \\text{ et } f(x) \\geq f(y)', w: 'x < y \\Rightarrow f(x) \\geq f(y)', pourquoi: '$\\text{non}(A \\Rightarrow B) \\equiv A \\text{ et non } B$ : ce n\'est pas une implication.', prefixes: [['\\forall', '\\forall'], ['\\exists', '\\forall']] },
  { p: 'f(x) = f(y) \\Rightarrow x = y', n: 'f(x) = f(y) \\text{ et } x \\neq y', w: 'f(x) \\neq f(y) \\Rightarrow x \\neq y', pourquoi: '$\\text{non}(A \\Rightarrow B) \\equiv A \\text{ et non } B$ ; ici on a écrit la contraposée de la réciproque.', prefixes: [['\\forall', '\\forall'], ['\\exists', '\\forall']] },
];

const autre = (q: Quant): Quant => (q === '\\forall' ? '\\exists' : '\\forall');
const prefixe = (qs: [Quant, string][]) => qs.map(([q, v]) => `${q} ${v} \\in \\mathbb{R}`).join(',\\ ');
const enonceQ = (qs: [Quant, string][], pred: string) => `$${prefixe(qs)},\\ ${pred}$`;

export const negationQuantifiee: Generateur = {
  id: 'logique-negation',
  titre: 'Négations',
  chapitre: 'logique',
  formes: ['qcm'],
  generer(rng, difficulte): Question {
    const deuxVars = difficulte >= 2 && (difficulte === 3 || rng() < 0.6);
    const pr = deuxVars ? pick(rng, difficulte === 3 ? PRED2_IMP : PRED2) : pick(rng, difficulte === 1 ? PRED1 : [...PRED1, ...PRED1_IMP]);
    const [q1, q2] = pr.prefixes ? pick(rng, pr.prefixes) : [pick(rng, ['\\forall', '\\exists'] as Quant[]), pick(rng, ['\\forall', '\\exists'] as Quant[])];
    const qs: [Quant, string][] = deuxVars
      ? [
          [q1, 'x'],
          [q2, 'y'],
        ]
      : [[q1, 'x']];
    const nies = qs.map(([q, v]) => [autre(q), v] as [Quant, string]);
    const correction = [
      'Pour nier, on échange chaque $\\forall$ et $\\exists$ (dans le même ordre), puis on nie la propriété finale.',
      `Négation de « $${pr.p}$ » : « $${pr.n}$ ».`,
      `Résultat : ${enonceQ(nies, pr.n)}.`,
    ];
    const distr: Candidat[] = [
      { texte: enonceQ(qs, pr.n), explication: 'Les quantificateurs doivent être échangés ($\\forall \\leftrightarrow \\exists$).' },
      { texte: enonceQ(nies, pr.w), explication: pr.pourquoi },
      { texte: enonceQ(nies, pr.p), explication: 'Il faut aussi nier la propriété finale.' },
    ];
    if (deuxVars) {
      distr.unshift({ texte: enonceQ([nies[0], qs[1]], pr.n), explication: 'TOUS les quantificateurs doivent être échangés, pas seulement le premier.' });
      // (Seulement si les quantificateurs diffèrent : sinon permuter ne change rien et ce serait juste.)
      if (qs[0][0] !== qs[1][0]) distr.push({ texte: enonceQ([nies[1], nies[0]], pr.n), explication: 'L\'ordre des quantificateurs doit être conservé.' });
    }
    return construireQcm(
      {
        difficulte,
        enonce: `$f : \\mathbb{R} \\to \\mathbb{R}$. Quelle est la négation de ${enonceQ(qs, pr.p)} ?`,
        indice: 'Échange $\\forall$ et $\\exists$ sans changer leur ordre, puis nie la propriété ($\\text{non}(A \\Rightarrow B) \\equiv A$ et non $B$).',
        correction,
      },
      { texte: enonceQ(nies, pr.n), explication: 'Quantificateurs échangés dans le même ordre, propriété correctement niée.' },
      distr,
    );
  },
};

/* ------------------------------------------------------------------ */
/* Dénombrement                                                        */
/* ------------------------------------------------------------------ */

type Genre = 'parties' | 'applications' | 'injections' | 'combinaisons' | 'permutations';

export const denombrement: Generateur = {
  id: 'ensembles-denombrement',
  titre: 'Dénombrement',
  chapitre: 'ensembles',
  formes: ['qcm', 'libre'],
  generer(rng, difficulte, forme): Question {
    const genre: Genre = pick(rng, difficulte === 1 ? ['parties', 'applications'] : difficulte === 2 ? ['injections', 'combinaisons', 'applications'] : ['injections', 'combinaisons', 'permutations']);
    const c = (v: number, explication: string): Candidat => ({ texte: `$${v}$`, explication, cle: cleNum(v) });
    let enonce: string;
    let rep: number;
    let correction: string[];
    let distr: Candidat[];
    switch (genre) {
      case 'parties': {
        const n = randInt(rng, 3, 6);
        enonce = `Combien l'ensemble $E = \\{1, \\dots, ${n}\\}$ possède-t-il de parties (sous-ensembles) ?`;
        rep = 2 ** n;
        correction = [`Chaque élément est dans la partie ou non : $2 \\times \\dots \\times 2 = 2^{${n}} = ${rep}$ (en comptant $\\emptyset$ et $E$).`];
        distr = [c(2 ** n - 1, 'Oubli de la partie vide $\\emptyset$.'), c(n * n, 'Ce n\'est pas $n^2$ mais $2^n$.'), c(2 * n, '$2n$ : les choix se multiplient (un par élément).'), c(fact(n), '$n!$ compte les permutations, pas les parties.')];
        break;
      }
      case 'applications': {
        const p = randInt(rng, 2, 4);
        let n = randInt(rng, 2, 5);
        while (n === p) n = randInt(rng, 2, 5);
        enonce = `Combien y a-t-il d'applications de $E = \\{1, \\dots, ${p}\\}$ dans $F = \\{1, \\dots, ${n}\\}$ ?`;
        rep = n ** p;
        correction = [`Chacun des ${p} éléments de $E$ choisit librement son image parmi ${n} : $${n}^{${p}} = ${rep}$.`];
        distr = [c(p ** n, `Exposant et base inversés : c'est $|F|^{|E|} = ${n}^{${p}}$.`), c(n * p, 'Les choix se MULTIPLIENT pour chaque élément de $E$ : on obtient une puissance.'), c(binom(n + p - 1, p), 'Ce n\'est pas une combinaison : l\'ordre des éléments de $E$ compte.'), c(n ** p - 1, 'Aucune application n\'est à exclure.')];
        break;
      }
      case 'injections': {
        const n = randInt(rng, 4, 7);
        const p = randInt(rng, 2, Math.min(4, n - 1));
        rep = fact(n) / fact(n - p);
        enonce = pick(rng, [
          `Combien y a-t-il d'injections de $\\{1, \\dots, ${p}\\}$ dans $\\{1, \\dots, ${n}\\}$ ?`,
          `Combien de « mots » de ${p} lettres DISTINCTES peut-on écrire avec un alphabet de ${n} lettres ?`,
        ]);
        correction = [`Le 1er élément a ${n} choix, le 2e ${n - 1} (image différente), etc. : $${Array.from({ length: p }, (_, i) => n - i).join(' \\times ')} = ${rep}$.`];
        distr = [c(n ** p, 'Répétitions interdites : ce n\'est pas $n^p$.'), c(binom(n, p), "L'ordre compte : il ne faut pas diviser par $p!$."), c(fact(n), `$n!$ compterait des suites de ${n} éléments, pas ${p}.`), c(p ** n, 'Base et exposant inversés.')];
        break;
      }
      case 'combinaisons': {
        const n = randInt(rng, 5, 9);
        const k = randInt(rng, 2, Math.min(4, n - 2));
        rep = binom(n, k);
        enonce = pick(rng, [
          `Combien un ensemble à ${n} éléments possède-t-il de parties à ${k} éléments ?`,
          `De combien de façons peut-on choisir ${k} délégués (sans ordre) dans une classe de ${n} élèves ?`,
        ]);
        correction = [`On choisit ${k} éléments sans ordre : $\\dbinom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!} = ${rep}$.`];
        distr = [c(fact(n) / fact(n - k), `L'ordre ne compte pas : il faut diviser par $${k}! = ${fact(k)}$.`), c(n ** k, 'Pas de répétition et pas d\'ordre : ce n\'est pas $n^k$.'), c(binom(n, k + 1), `Mauvais $k$ : c'est $\\binom{${n}}{${k}}$.`), c(n * k, 'Ce n\'est pas un produit simple.')];
        break;
      }
      default: {
        const n = randInt(rng, 4, 7);
        rep = fact(n);
        enonce = pick(rng, [`Combien y a-t-il de bijections de $\\{1, \\dots, ${n}\\}$ dans lui-même ?`, `De combien de façons peut-on ranger ${n} livres différents sur une étagère ?`]);
        correction = [`On choisit l'image (la place) de chaque élément : $${n} \\times ${n - 1} \\times \\dots \\times 1 = ${n}! = ${rep}$.`];
        distr = [c(n ** n, 'Les images doivent être distinctes : ce n\'est pas $n^n$.'), c(2 ** n, '$2^n$ compte les parties.'), c(n * n, 'Ce n\'est pas $n^2$.'), c(fact(n - 1), 'Un facteur oublié : il y a $n$ choix pour le premier.')];
      }
    }
    const indice = "Demande-toi : l'ordre compte-t-il ? Les répétitions sont-elles permises ?";
    if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: rep };
    return construireQcm({ difficulte, enonce, indice, correction }, c(rep, 'Bon modèle de dénombrement.'), distr);
  },
};
