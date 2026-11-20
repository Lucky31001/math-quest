/**
 * Générateurs — physique (pré-ing 1).
 *
 * Applications numériques : les données sont affichées sous la forme
 * « $X = valeur\ unité$ » (relues par les tests), la réponse est attendue dans
 * une unité où elle vaut au moins 1 (tolérance relative de 1 %, cf. CLAUDE.md).
 * Les distracteurs de QCM sont des erreurs typiques ; ceux qui tombent à moins
 * de 2 % de la bonne réponse sont écartés (ils seraient « vrais aussi »).
 */
import { randInt, pick, type Rng } from '../core/random';
import type { Difficulte, Question } from '../core/schema';
import { construireQcm, cleNum, type Forme, type Generateur } from './outils';

export const G = 9.81;
const R_GAZ = 8.314;
const C_EAU = 4180;
const deg = (a: number): number => (a * Math.PI) / 180;
const enDeg = (r: number): number => (r * 180) / Math.PI;

/** Nombre à 3 chiffres significatifs, virgule française : 12{,}5 ; 0{,}1 ; 4180. */
export function nombre(x: number, chiffres = 3): string {
  if (x === 0) return '0';
  const p = Math.max(0, chiffres - 1 - Math.floor(Math.log10(Math.abs(x))));
  let s = x.toFixed(Math.min(p, 6));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', '{,}');
}

/** Grandeur LaTeX : valeur + unité (unité en LaTeX, ex. `\mathrm{m/s}`, `\Omega`, `^\circ`). */
const qte = (x: number, unite: string): string => (!unite || unite.startsWith('^') ? `${nombre(x)}${unite}` : `${nombre(x)}\\ ${unite}`);
/** Donnée de l'énoncé, toujours écrite « $X = valeur\ unité$ » (relue par les tests). */
const donnee = (symbole: string, x: number, unite: string, chiffres = 3): string =>
  `$${symbole} = ${chiffres === 3 ? qte(x, unite) : `${nombre(x, chiffres)}\\ ${unite}`}$`;
const M = (u: string): string => `\\mathrm{${u}}`;
const DONNEE_G = donnee('g', G, M('m\\cdot s^{-2}'));

interface Probleme {
  enonce: string;
  indice: string;
  correction: string[];
  valeur: number;
  /** Unité de la réponse, en LaTeX. */
  unite: string;
  explication: string;
  /** Erreurs typiques : [valeur, explication]. */
  pieges: [number, string][];
}

/** Assemble la question (réponse libre ou QCM) à partir d'un problème. */
function produire(p: Probleme, difficulte: Difficulte, forme: Forme): Question {
  const { enonce, indice, correction } = p;
  if (forme === 'libre') return { id: '', type: 'numerique', difficulte, enonce, indice, correction, reponse: p.valeur, tolerance: 0.01 };
  const retenus: [number, string][] = [];
  const loin = (a: number, b: number): boolean => Math.abs(a - b) > 0.02 * Math.max(Math.abs(a), Math.abs(b));
  for (const [v, e] of p.pieges)
    if (Number.isFinite(v) && v !== 0 && loin(v, p.valeur) && retenus.every(([w]) => loin(v, w))) retenus.push([v, e]);
  const cand = (v: number, explication: string) => ({ texte: `$${qte(v, p.unite)}$`, explication, cle: cleNum(Number(nombre(v).replace('{,}', '.'))) });
  return construireQcm(
    { difficulte, enonce, indice, correction },
    cand(p.valeur, p.explication),
    retenus.map(([v, e]) => cand(v, e)),
  );
}

const generateur = (id: string, titre: string, chapitre: string, probleme: (rng: Rng, d: Difficulte) => Probleme): Generateur => ({
  id,
  titre,
  chapitre,
  formes: ['qcm', 'libre'],
  generer: (rng, difficulte, forme) => produire(probleme(rng, difficulte), difficulte, forme),
});

/* ------------------------------------------------------------------ */
/* Cinématique                                                         */
/* ------------------------------------------------------------------ */

export const cinematique = generateur('phys-cinematique', 'Mouvements rectilignes et chute libre', 'cinematique', (rng, d) => {
  if (d === 1) {
    const v0 = pick(rng, [10, 15, 20, 25, 30]);
    const a = pick(rng, [2, 4, 5, 8]);
    const dist = (v0 * v0) / (2 * a);
    return {
      enonce: `Une voiture roulant à ${donnee('v_0', v0, M('m/s'))} freine avec une décélération constante ${donnee('a', a, M('m/s^2'))}. Quelle distance parcourt-elle avant de s'arrêter (en m) ?`,
      indice: 'Sans le temps : $v^2 - v_0^2 = 2 a\\,d$ (avec $a < 0$ ici).',
      correction: [`À l'arrêt $v = 0$ : $0 - v_0^2 = -2 a\\,d$.`, `$d = \\dfrac{v_0^2}{2a} = \\dfrac{${v0}^2}{2 \\times ${a}} = ${qte(dist, M('m'))}$.`],
      valeur: dist,
      unite: M('m'),
      explication: '$d = v_0^2 / (2a)$.',
      pieges: [
        [(v0 * v0) / a, 'Oubli du facteur 2 : $d = v_0 t - \\frac{1}{2} a t^2$ avec $t = v_0 / a$ donne $v_0^2/(2a)$.'],
        [v0 / a, "C'est la durée du freinage (en s), pas la distance."],
        [v0 / (2 * a), 'Oubli du carré sur $v_0$.'],
        [2 * a * v0, 'Formule inversée : on cherche $d$ dans $v_0^2 = 2 a d$.'],
      ],
    };
  }
  if (d === 2) {
    const h = pick(rng, [5, 10, 20, 45, 80]);
    const v = Math.sqrt(2 * G * h);
    return {
      enonce: `Un objet est lâché sans vitesse initiale d'une hauteur ${donnee('h', h, M('m'))} ; ${DONNEE_G}, frottements négligés. Vitesse en arrivant au sol (en m/s) ?`,
      indice: 'Chute libre : $v^2 = 2 g h$ (ou conservation de l’énergie mécanique).',
      correction: ['Seul le poids travaille : $\\frac{1}{2} m v^2 = m g h$.', `$v = \\sqrt{2 g h} = \\sqrt{2 \\times 9{,}81 \\times ${h}} = ${qte(v, M('m/s'))}$.`],
      valeur: v,
      unite: M('m/s'),
      explication: '$v = \\sqrt{2gh}$.',
      pieges: [
        [Math.sqrt(G * h), 'Oubli du facteur 2 sous la racine.'],
        [G * h, 'Oubli de la racine carrée (et du facteur 2).'],
        [Math.sqrt((2 * h) / G), "C'est la durée de la chute (en s), pas la vitesse."],
        [2 * G * h, "C'est $v^2$ : il manque la racine carrée."],
      ],
    };
  }
  const h = pick(rng, [0.8, 1, 1.25, 1.8, 2]);
  const v0 = pick(rng, [2, 3, 4, 5]);
  const t = Math.sqrt((2 * h) / G);
  const x = 100 * v0 * t;
  return {
    enonce: `Une bille quitte le bord d'une table de hauteur ${donnee('h', h, M('m'))} avec une vitesse horizontale ${donnee('v_0', v0, M('m/s'))} ; ${DONNEE_G}. À quelle distance horizontale du pied de la table touche-t-elle le sol (en cm) ?`,
    indice: 'Mouvement uniforme horizontalement, chute libre verticalement : calcule d’abord la durée de chute.',
    correction: [
      `Verticalement : $h = \\frac{1}{2} g t^2$ donc $t = \\sqrt{2h/g} = ${qte(t, M('s'))}$.`,
      `Horizontalement : $x = v_0 t = ${v0} \\times ${nombre(t)} = ${qte(x, M('cm'))}$.`,
    ],
    valeur: x,
    unite: M('cm'),
    explication: '$x = v_0 \\sqrt{2h/g}$.',
    pieges: [
      [100 * v0 * Math.sqrt(h / G), 'Oubli du facteur 2 dans $t = \\sqrt{2h/g}$.'],
      [(100 * v0 * 2 * h) / G, 'Oubli de la racine carrée dans la durée de chute.'],
      [100 * v0 * Math.sqrt(2 * h * G), 'Durée de chute mal isolée : $t = \\sqrt{2h/g}$, pas $\\sqrt{2hg}$.'],
      [100 * t, "C'est la durée de chute (×100), pas la distance."],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Dynamique                                                           */
/* ------------------------------------------------------------------ */

export const dynamique = generateur('phys-dynamique', 'Principe fondamental de la dynamique', 'dynamique', (rng, d) => {
  if (d === 1) {
    const m = pick(rng, [2, 5, 10, 50, 1200]);
    const a = pick(rng, [1.5, 2, 2.5, 3, 4]);
    const F = m * a;
    return {
      enonce: `Une force constante ${donnee('F', F, M('N'))} est la seule force horizontale appliquée à un objet de masse ${donnee('m', m, M('kg'))}. Son accélération (en m/s²) ?`,
      indice: 'Deuxième loi de Newton : $\\sum \\vec F = m \\vec a$.',
      correction: [`$a = \\dfrac{F}{m} = \\dfrac{${nombre(F)}}{${m}} = ${qte(a, M('m/s^2'))}$.`],
      valeur: a,
      unite: M('m/s^2'),
      explication: '$a = F/m$.',
      pieges: [
        [F * m, 'Il faut diviser par la masse, pas multiplier.'],
        [m / F, 'Quotient inversé : $a = F/m$.'],
        [F / (m * G), 'Pas de $g$ ici : le poids est vertical, compensé par la réaction du support.'],
        [F, 'La masse a été oubliée.'],
      ],
    };
  }
  const alpha = d === 2 ? pick(rng, [15, 20, 30, 45, 60]) : pick(rng, [30, 45, 60]);
  if (d === 2) {
    const a = G * Math.sin(deg(alpha));
    return {
      enonce: `Un palet glisse sans frottement sur un plan incliné d'un angle ${donnee('\\alpha', alpha, '^\\circ')} sur l'horizontale ; ${DONNEE_G}. Son accélération (en m/s²) ?`,
      indice: 'Projette le poids sur l’axe de la pente ; la réaction est perpendiculaire au plan.',
      correction: [
        'Sur l’axe de la pente : $m a = m g \\sin\\alpha$ (la réaction normale ne travaille pas).',
        `$a = g \\sin\\alpha = 9{,}81 \\times \\sin ${alpha}^\\circ = ${qte(a, M('m/s^2'))}$.`,
      ],
      valeur: a,
      unite: M('m/s^2'),
      explication: '$a = g \\sin\\alpha$.',
      pieges: [
        [G * Math.cos(deg(alpha)), 'Mauvaise projection : $\\cos\\alpha$ correspond à la composante normale au plan.'],
        [G * Math.tan(deg(alpha)), 'Ce n’est pas une tangente : on projette le poids sur la pente.'],
        [G, 'Ce serait une chute libre verticale.'],
        [G * Math.sin(alpha), 'Calculatrice en radians au lieu de degrés.'],
        [G / Math.sin(deg(alpha)), 'La projection multiplie par $\\sin\\alpha$, elle ne divise pas.'],
      ],
    };
  }
  const mu = pick(rng, [0.1, 0.2, 0.3]);
  const a = G * (Math.sin(deg(alpha)) - mu * Math.cos(deg(alpha)));
  return {
    enonce: `Un bloc glisse vers le bas d'un plan incliné d'un angle ${donnee('\\alpha', alpha, '^\\circ')} ; le coefficient de frottement de glissement vaut ${donnee('\\mu', mu, '')} et ${DONNEE_G}. Son accélération (en m/s²) ?`,
    indice: 'Frottement solide : $T = \\mu N$, avec $N = m g \\cos\\alpha$ ; il s’oppose au glissement.',
    correction: [
      'Selon la normale : $N = m g \\cos\\alpha$. Selon la pente (vers le bas) : $m a = m g \\sin\\alpha - \\mu N$.',
      `$a = g(\\sin\\alpha - \\mu\\cos\\alpha) = 9{,}81\\,(\\sin ${alpha}^\\circ - ${nombre(mu)} \\cos ${alpha}^\\circ) = ${qte(a, M('m/s^2'))}$.`,
    ],
    valeur: a,
    unite: M('m/s^2'),
    explication: '$a = g(\\sin\\alpha - \\mu\\cos\\alpha)$.',
    pieges: [
      [G * (Math.sin(deg(alpha)) + mu * Math.cos(deg(alpha))), 'Le frottement s’oppose au mouvement : il se retranche.'],
      [G * Math.sin(deg(alpha)), 'Les frottements ont été oubliés.'],
      [G * (Math.sin(deg(alpha)) - mu * Math.sin(deg(alpha))), 'La réaction normale vaut $m g \\cos\\alpha$, pas $m g \\sin\\alpha$.'],
      [G * (Math.cos(deg(alpha)) - mu * Math.sin(deg(alpha))), 'Projections inversées (sinus et cosinus).'],
      [G * (Math.sin(deg(alpha)) - mu), 'Le frottement vaut $\\mu N$ avec $N = m g \\cos\\alpha$, pas $\\mu m g$.'],
      [G * mu * Math.cos(deg(alpha)), 'C’est seulement la décélération due au frottement : il manque la composante du poids.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Électrocinétique                                                    */
/* ------------------------------------------------------------------ */

export const electrocinetique = generateur('phys-electrocinetique', 'Lois de l’électrocinétique', 'electrocinetique', (rng, d) => {
  if (d === 1) {
    const U = pick(rng, [5, 9, 12]);
    const R = pick(rng, [100, 220, 470, 1000]);
    const I = (1000 * U) / R;
    return {
      enonce: `Une résistance ${donnee('R', R, '\\Omega')} est soumise à une tension ${donnee('U', U, M('V'))}. Intensité du courant qui la traverse (en mA) ?`,
      indice: 'Loi d’Ohm : $U = R I$. Attention à l’unité demandée.',
      correction: [`$I = \\dfrac{U}{R} = \\dfrac{${U}}{${R}} = ${nombre(U / R)}\\ \\mathrm{A} = ${qte(I, M('mA'))}$.`],
      valeur: I,
      unite: M('mA'),
      explication: '$I = U/R$, converti en mA.',
      pieges: [
        [U / R, 'Résultat en ampères : il faut le convertir en mA (×1000).'],
        [U * R, 'Loi d’Ohm mal inversée : $I = U/R$.'],
        [(1000 * R) / U, 'Quotient inversé : $I = U/R$.'],
        [(1e6 * U) / R, 'Mauvaise conversion : 1 A = 1000 mA.'],
      ],
    };
  }
  if (d === 2) {
    const [R1, R2] = pick(rng, [[10, 40], [20, 30], [30, 60], [40, 60], [100, 150], [12, 24], [60, 120]] as const);
    const Req = (R1 * R2) / (R1 + R2);
    return {
      enonce: `Deux résistances ${donnee('R_1', R1, '\\Omega')} et ${donnee('R_2', R2, '\\Omega')} sont montées en dérivation. Résistance équivalente (en Ω) ?`,
      indice: 'En dérivation, les conductances s’ajoutent : $\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2}$.',
      correction: [`$R_{eq} = \\dfrac{R_1 R_2}{R_1 + R_2} = \\dfrac{${R1} \\times ${R2}}{${R1 + R2}} = ${qte(Req, '\\Omega')}$.`, 'Elle est plus petite que chacune des deux résistances.'],
      valeur: Req,
      unite: '\\Omega',
      explication: '$R_{eq} = R_1 R_2 / (R_1 + R_2)$.',
      pieges: [
        [R1 + R2, 'C’est l’association en série.'],
        [(R1 + R2) / 2, 'Ce n’est pas une moyenne.'],
        [1 / R1 + 1 / R2, 'C’est $1/R_{eq}$ : il faut encore prendre l’inverse.'],
        [R1 * R2, 'Il manque la division par $R_1 + R_2$.'],
      ],
    };
  }
  const R = pick(rng, [1, 2.2, 4.7, 10]);
  const C = pick(rng, [1, 10, 47, 100]);
  const tau = R * C; // kΩ × µF = ms
  const t = tau * Math.log(20);
  return {
    enonce: `Un condensateur ${donnee('C', C, '\\mu\\mathrm{F}')}, initialement déchargé, se charge à travers ${donnee('R', R, '\\mathrm{k}\\Omega')} sous une tension constante $E$. Au bout de combien de temps $u_C$ atteint-elle 95 % de $E$ (en ms) ?`,
    indice: '$u_C(t) = E\\,(1 - e^{-t/\\tau})$ avec $\\tau = RC$.',
    correction: [
      `$\\tau = RC = ${nombre(R)}\\ \\mathrm{k}\\Omega \\times ${C}\\ \\mu\\mathrm{F} = ${qte(tau, M('ms'))}$.`,
      '$1 - e^{-t/\\tau} = 0{,}95 \\iff e^{-t/\\tau} = 0{,}05 \\iff t = \\tau \\ln 20 \\approx 3\\tau$.',
      `$t = ${nombre(tau)} \\times \\ln 20 = ${qte(t, M('ms'))}$.`,
    ],
    valeur: t,
    unite: M('ms'),
    explication: '$t = \\tau \\ln 20 \\approx 3\\tau$.',
    pieges: [
      [tau, '$\\tau$ correspond à 63 % de la charge, pas 95 %.'],
      [5 * tau, '$5\\tau$ correspond à 99 % de la charge.'],
      [tau * 0.95, 'On ne multiplie pas $\\tau$ par 0,95 : la charge est exponentielle.'],
      [tau / Math.log(20), 'Il faut multiplier $\\tau$ par $\\ln 20$, pas diviser.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Énergie mécanique                                                   */
/* ------------------------------------------------------------------ */

export const energie = generateur('phys-energie', 'Énergie cinétique, potentielle, mécanique', 'energie-mecanique', (rng, d) => {
  if (d === 1) {
    const m = pick(rng, [2, 5, 10, 60, 80]);
    const v = pick(rng, [2, 3, 4, 5, 10]);
    const Ec = 0.5 * m * v * v;
    return {
      enonce: `Énergie cinétique d'un objet de masse ${donnee('m', m, M('kg'))} se déplaçant à ${donnee('v', v, M('m/s'))} (en J) ?`,
      indice: '$E_c = \\frac{1}{2} m v^2$.',
      correction: [`$E_c = \\frac{1}{2} \\times ${m} \\times ${v}^2 = ${qte(Ec, M('J'))}$.`],
      valeur: Ec,
      unite: M('J'),
      explication: '$E_c = \\frac{1}{2} m v^2$.',
      pieges: [
        [m * v * v, 'Oubli du facteur $\\frac{1}{2}$.'],
        [0.5 * m * v, 'Oubli du carré sur la vitesse.'],
        [m * v, 'C’est la quantité de mouvement $p = mv$ (en kg·m/s).'],
        [0.5 * m * m * v, 'C’est la vitesse qui est au carré, pas la masse.'],
      ],
    };
  }
  if (d === 2) {
    const v0 = pick(rng, [5, 8, 10, 12, 15, 20]);
    const h = (v0 * v0) / (2 * G);
    return {
      enonce: `Une balle est lancée verticalement vers le haut avec la vitesse ${donnee('v_0', v0, M('m/s'))} ; ${DONNEE_G}, frottements négligés. Hauteur maximale atteinte au-dessus du point de lancer (en m) ?`,
      indice: 'Conservation de l’énergie mécanique entre le lancer et le sommet (où $v = 0$).',
      correction: ['$\\frac{1}{2} m v_0^2 = m g h$ (au sommet, la vitesse est nulle).', `$h = \\dfrac{v_0^2}{2g} = \\dfrac{${v0}^2}{2 \\times 9{,}81} = ${qte(h, M('m'))}$.`],
      valeur: h,
      unite: M('m'),
      explication: '$h = v_0^2 / (2g)$.',
      pieges: [
        [(v0 * v0) / G, 'Oubli du facteur $\\frac{1}{2}$ de l’énergie cinétique.'],
        [v0 / G, 'C’est la durée de montée (en s), pas la hauteur.'],
        [(v0 * v0) / 2, 'La masse se simplifie, mais pas $g$.'],
        [(2 * v0 * v0) / G, 'Facteur 2 au mauvais endroit : $h = v_0^2 / (2g)$.'],
      ],
    };
  }
  let m = 0;
  let h = 0;
  let v = 0;
  do {
    m = pick(rng, [2, 5, 10]);
    h = pick(rng, [2, 5, 10]);
    v = pick(rng, [2, 4, 6, 8]);
  } while (0.5 * v * v >= G * h * 0.8);
  const W = m * G * h - 0.5 * m * v * v;
  return {
    enonce: `Un chariot de masse ${donnee('m', m, M('kg'))} part sans vitesse du haut d'une pente de dénivelé ${donnee('h', h, M('m'))} et arrive en bas à la vitesse ${donnee('v', v, M('m/s'))} ; ${DONNEE_G}. Énergie dissipée par les frottements (en J) ?`,
    indice: 'La variation d’énergie mécanique est égale au travail des frottements.',
    correction: [
      `$E_m$ en haut : $m g h = ${nombre(m * G * h)}\\ \\mathrm{J}$. En bas : $\\frac{1}{2} m v^2 = ${nombre(0.5 * m * v * v)}\\ \\mathrm{J}$.`,
      `Énergie dissipée : $m g h - \\frac{1}{2} m v^2 = ${qte(W, M('J'))}$.`,
    ],
    valeur: W,
    unite: M('J'),
    explication: 'Perte d’énergie mécanique $m g h - \\frac{1}{2} m v^2$.',
    pieges: [
      [m * G * h + 0.5 * m * v * v, 'Les deux énergies ne s’ajoutent pas : on fait la différence.'],
      [m * G * h, 'C’est l’énergie mécanique de départ, pas la perte.'],
      [0.5 * m * v * v, 'C’est l’énergie cinétique à l’arrivée.'],
      [m * G * h - m * v * v, 'Oubli du facteur $\\frac{1}{2}$ dans l’énergie cinétique.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Optique géométrique                                                 */
/* ------------------------------------------------------------------ */

export const optique = generateur('phys-optique', 'Réfraction et lentilles minces', 'optique-geometrique', (rng, d) => {
  if (d === 1) {
    const f = pick(rng, [10, 20, 25, 40, 50]);
    const V = 100 / f;
    return {
      enonce: `Une lentille mince convergente a pour distance focale ${donnee("f'", f, M('cm'))}. Sa vergence (en δ) ?`,
      indice: '$V = \\frac{1}{f\'}$, avec $f\'$ en mètres.',
      correction: [`$f' = ${nombre(f / 100)}\\ \\mathrm{m}$, donc $V = \\dfrac{1}{${nombre(f / 100)}} = ${qte(V, '\\delta')}$.`],
      valeur: V,
      unite: '\\delta',
      explication: '$V = 1/f\'$ avec $f\'$ en m.',
      pieges: [
        [1 / f, 'La distance focale doit être en mètres, pas en centimètres.'],
        [f / 100, 'C’est $f\'$ en mètres : la vergence est son inverse.'],
        [f, 'C’est la distance focale (en cm), pas la vergence.'],
        [-V, 'Une lentille convergente a une vergence positive.'],
      ],
    };
  }
  if (d === 2) {
    const n2 = pick(rng, [1.33, 1.5]);
    const i1 = pick(rng, [30, 45, 60]);
    const i2 = enDeg(Math.asin(Math.sin(deg(i1)) / n2));
    return {
      enonce: `Un rayon passe de l'air ($n_1 = 1$) dans un milieu d'indice ${donnee('n_2', n2, '')} avec un angle d'incidence ${donnee('i_1', i1, '^\\circ')}. Angle de réfraction (en degrés) ?`,
      indice: 'Loi de Snell-Descartes : $n_1 \\sin i_1 = n_2 \\sin i_2$.',
      correction: [`$\\sin i_2 = \\dfrac{\\sin ${i1}^\\circ}{${nombre(n2)}} = ${nombre(Math.sin(deg(i1)) / n2)}$.`, `$i_2 = \\arcsin(${nombre(Math.sin(deg(i1)) / n2)}) = ${qte(i2, '^\\circ')}$ : le rayon se rapproche de la normale.`],
      valeur: i2,
      unite: '^\\circ',
      explication: '$\\sin i_2 = \\sin i_1 / n_2$.',
      pieges: [
        [i1 / n2, 'La loi porte sur les sinus des angles, pas sur les angles.'],
        [i1, 'Le rayon est dévié en changeant de milieu.'],
        [90 - i2, 'Angle mesuré par rapport à la surface au lieu de la normale.'],
        [i1 * n2, 'Rapport inversé : en entrant dans un milieu plus réfringent, le rayon se rapproche de la normale.'],
      ],
    };
  }
  const f = pick(rng, [10, 15, 20]);
  const OA = -pick(rng, [15, 20, 25, 30, 40, 60].filter((x) => x > f * 1.2));
  const OAp = (f * OA) / (f + OA);
  return {
    enonce: `Un objet est placé à ${donnee('\\overline{OA}', OA, M('cm'))} d'une lentille convergente de distance focale ${donnee("f'", f, M('cm'))}. Position $\\overline{OA'}$ de l'image (en cm) ?`,
    indice: 'Relation de conjugaison : $\\frac{1}{\\overline{OA\'}} - \\frac{1}{\\overline{OA}} = \\frac{1}{f\'}$.',
    correction: [
      `$\\dfrac{1}{\\overline{OA'}} = \\dfrac{1}{f'} + \\dfrac{1}{\\overline{OA}} = \\dfrac{1}{${f}} + \\dfrac{1}{${OA}}$.`,
      `$\\overline{OA'} = \\dfrac{f' \\cdot \\overline{OA}}{f' + \\overline{OA}} = ${qte(OAp, M('cm'))}$ : image réelle, après la lentille.`,
    ],
    valeur: OAp,
    unite: M('cm'),
    explication: 'Relation de conjugaison de Descartes.',
    pieges: [
      [1 / (1 / f - 1 / OA), 'Erreur de signe : $\\frac{1}{\\overline{OA\'}} = \\frac{1}{f\'} + \\frac{1}{\\overline{OA}}$.'],
      [-OA, 'L’image n’est pas symétrique de l’objet (ce serait le cas pour $\\overline{OA} = -2f\'$ seulement).'],
      [f + OA, 'Les inverses des distances s’ajoutent, pas les distances.'],
      [-OAp, 'Erreur de signe : l’image d’un objet réel placé avant le foyer est réelle ($\\overline{OA\'} > 0$).'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Oscillateurs                                                        */
/* ------------------------------------------------------------------ */

export const oscillateurs = generateur('phys-oscillateurs', 'Oscillateur harmonique', 'oscillateurs', (rng, d) => {
  if (d === 1) {
    const w = pick(rng, [2, 4, 5, 10, 20]);
    const m = pick(rng, [0.1, 0.2, 0.5, 1, 2]);
    const k = m * w * w;
    return {
      enonce: `Une masse ${donnee('m', m, M('kg'))} est accrochée à un ressort de raideur ${donnee('k', k, M('N/m'))}. Pulsation propre $\\omega_0$ (en rad/s) ?`,
      indice: '$\\omega_0 = \\sqrt{k/m}$.',
      correction: [`$\\omega_0 = \\sqrt{\\dfrac{k}{m}} = \\sqrt{\\dfrac{${nombre(k)}}{${nombre(m)}}} = ${qte(w, M('rad/s'))}$.`],
      valeur: w,
      unite: M('rad/s'),
      explication: '$\\omega_0 = \\sqrt{k/m}$.',
      pieges: [
        [k / m, 'Il manque la racine carrée : c’est $\\omega_0^2$.'],
        [Math.sqrt(k * m), 'C’est $k/m$ sous la racine, pas $k \\cdot m$.'],
        [w / (2 * Math.PI), 'C’est la fréquence propre $f_0$ (en Hz).'],
        [2 * Math.PI * w, 'On ne multiplie pas par $2\\pi$ : $\\omega_0 = 2\\pi f_0$.'],
      ],
    };
  }
  if (d === 2) {
    const m = pick(rng, [0.5, 1, 2, 4]);
    const k = pick(rng, [10, 20, 50, 100]);
    const T = 1000 * 2 * Math.PI * Math.sqrt(m / k);
    return {
      enonce: `Une masse ${donnee('m', m, M('kg'))} oscille au bout d'un ressort de raideur ${donnee('k', k, M('N/m'))}. Période propre (en ms) ?`,
      indice: '$T_0 = \\frac{2\\pi}{\\omega_0} = 2\\pi\\sqrt{m/k}$.',
      correction: [`$T_0 = 2\\pi \\sqrt{\\dfrac{m}{k}} = 2\\pi \\sqrt{\\dfrac{${nombre(m)}}{${k}}} = ${qte(T, M('ms'))}$.`],
      valeur: T,
      unite: M('ms'),
      explication: '$T_0 = 2\\pi\\sqrt{m/k}$.',
      pieges: [
        [1000 * Math.sqrt(m / k), 'Oubli du facteur $2\\pi$.'],
        [(1000 * 2 * Math.PI * m) / k, 'Oubli de la racine carrée.'],
        [1000 * 2 * Math.PI * Math.sqrt(k / m), 'Rapport inversé : $T_0 = 2\\pi\\sqrt{m/k}$.'],
        [T / 1000, 'Résultat en secondes : il fallait le convertir en ms.'],
      ],
    };
  }
  const L = pick(rng, [0.25, 0.5, 1, 2, 4]);
  const T = 2 * Math.PI * Math.sqrt(L / G);
  return {
    enonce: `Pendule simple de longueur ${donnee('L', L, M('m'))}, petites oscillations ; ${DONNEE_G}. Période (en s) ?`,
    indice: 'Pour les petites oscillations : $T_0 = 2\\pi\\sqrt{L/g}$.',
    correction: [`$T_0 = 2\\pi\\sqrt{\\dfrac{L}{g}} = 2\\pi\\sqrt{\\dfrac{${nombre(L)}}{9{,}81}} = ${qte(T, M('s'))}$.`, 'Elle ne dépend pas de la masse (isochronisme des petites oscillations).'],
    valeur: T,
    unite: M('s'),
    explication: '$T_0 = 2\\pi\\sqrt{L/g}$.',
    pieges: [
      [2 * Math.PI * Math.sqrt(G / L), 'Rapport inversé : c’est $L/g$ sous la racine.'],
      [Math.sqrt(L / G), 'Oubli du facteur $2\\pi$.'],
      [(2 * Math.PI * L) / G, 'Oubli de la racine carrée.'],
      [Math.PI * Math.sqrt(L / G), 'Le facteur est $2\\pi$, pas $\\pi$.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Thermodynamique                                                     */
/* ------------------------------------------------------------------ */

export const thermodynamique = generateur('phys-thermo', 'Calorimétrie et gaz parfait', 'thermodynamique', (rng, d) => {
  if (d === 1) {
    const m = pick(rng, [0.2, 0.5, 1, 2]);
    const dT = pick(rng, [10, 20, 30, 50, 80]);
    const Q = (m * C_EAU * dT) / 1000;
    return {
      enonce: `Énergie nécessaire pour chauffer ${donnee('m', m, M('kg'))} d'eau de ${donnee('\\Delta T', dT, M('K'))}, avec ${donnee('c', C_EAU, M('J\\cdot kg^{-1}\\cdot K^{-1}'))} (en kJ) ?`,
      indice: '$Q = m\\,c\\,\\Delta T$.',
      correction: [`$Q = m c \\Delta T = ${nombre(m)} \\times 4180 \\times ${dT} = ${nombre(Q * 1000)}\\ \\mathrm J = ${qte(Q, M('kJ'))}$.`],
      valeur: Q,
      unite: M('kJ'),
      explication: '$Q = m c \\Delta T$, converti en kJ.',
      pieges: [
        [Q * 1000, 'Résultat en joules : il fallait le convertir en kJ.'],
        [(m * C_EAU * (dT + 273)) / 1000, 'Seul l’écart de température compte (un écart en K vaut le même écart en °C).'],
        [(C_EAU * dT) / m / 1000, 'La masse multiplie, elle ne divise pas.'],
        [(m * C_EAU) / 1000, 'L’écart de température a été oublié.'],
      ],
    };
  }
  if (d === 2) {
    const n = pick(rng, [0.5, 1, 2]);
    const T = pick(rng, [273, 300, 350]);
    const V = pick(rng, [10, 20, 25, 50]);
    const P = (n * R_GAZ * T) / V; // kPa, avec V en L
    return {
      enonce: `${donnee('n', n, M('mol'))} de gaz parfait occupent ${donnee('V', V, M('L'))} à ${donnee('T', T, M('K'))}, avec ${donnee('R', R_GAZ, M('J\\cdot mol^{-1}\\cdot K^{-1}'), 4)}. Pression (en kPa) ?`,
      indice: '$PV = nRT$ en unités SI : le volume en m³ (1 L = $10^{-3}$ m³).',
      correction: [
        `$V = ${V} \\times 10^{-3}\\ \\mathrm{m^3}$.`,
        `$P = \\dfrac{nRT}{V} = \\dfrac{${nombre(n)} \\times 8{,}314 \\times ${T}}{${V} \\times 10^{-3}} = ${nombre(P * 1000)}\\ \\mathrm{Pa} = ${qte(P, M('kPa'))}$.`,
      ],
      valeur: P,
      unite: M('kPa'),
      explication: '$P = nRT/V$ avec $V$ en m³.',
      pieges: [
        [P * 1000, 'Résultat en pascals : il fallait le convertir en kPa.'],
        [P / 1000, 'Volume laissé en litres : il faut le convertir en m³.'],
        [(n * R_GAZ * T * V) / 1000, 'La pression est inversement proportionnelle au volume.'],
        [T === 273 ? NaN : (n * R_GAZ * (T - 273)) / V, 'La température doit être en kelvins, pas en °C.'],
      ],
    };
  }
  const m1 = pick(rng, [100, 200, 300]);
  const m2 = pick(rng, [200, 300, 500].filter((x) => x !== m1));
  const T1 = randInt(rng, 10, 25);
  const T2 = randInt(rng, 60, 90);
  const Teq = (m1 * T1 + m2 * T2) / (m1 + m2);
  return {
    enonce: `On mélange ${donnee('m_1', m1, M('g'))} d'eau à ${donnee('T_1', T1, '^\\circ\\mathrm{C}')} et ${donnee('m_2', m2, M('g'))} d'eau à ${donnee('T_2', T2, '^\\circ\\mathrm{C}')}, dans un récipient isolé de capacité thermique négligeable. Température finale (en °C) ?`,
    indice: 'Système isolé : la somme des chaleurs reçues est nulle, $m_1 c (T_f - T_1) + m_2 c (T_f - T_2) = 0$.',
    correction: [
      '$c$ se simplifie : $T_f = \\dfrac{m_1 T_1 + m_2 T_2}{m_1 + m_2}$ (moyenne pondérée par les masses).',
      `$T_f = \\dfrac{${m1} \\times ${T1} + ${m2} \\times ${T2}}{${m1 + m2}} = ${qte(Teq, '^\\circ\\mathrm{C}')}$.`,
    ],
    valeur: Teq,
    unite: '^\\circ\\mathrm{C}',
    explication: 'Moyenne des températures pondérée par les masses.',
    pieges: [
      [(T1 + T2) / 2, 'Moyenne simple : elle ne vaut que si les masses sont égales.'],
      [(m1 * T2 + m2 * T1) / (m1 + m2), 'Masses et températures croisées.'],
      [T2 - T1, 'C’est l’écart de température initial.'],
      [(m1 * T1 + m2 * T2) / m2, 'Il faut diviser par la masse totale.'],
    ],
  };
});

/* ------------------------------------------------------------------ */
/* Grandeurs et unités                                                 */
/* ------------------------------------------------------------------ */

export const unites = generateur('phys-unites', 'Conversions d’unités', 'grandeurs-unites', (rng, d) => {
  if (d === 1) {
    const v = pick(rng, [18, 36, 54, 72, 90, 108, 130]);
    const r = v / 3.6;
    return {
      enonce: `Convertir ${donnee('v', v, M('km/h'))} en m/s.`,
      indice: '1 km/h = 1000 m / 3600 s.',
      correction: [`$1\\ \\mathrm{km/h} = \\dfrac{1000}{3600}\\ \\mathrm{m/s} = \\dfrac{1}{3{,}6}\\ \\mathrm{m/s}$.`, `$v = \\dfrac{${v}}{3{,}6} = ${qte(r, M('m/s'))}$.`],
      valeur: r,
      unite: M('m/s'),
      explication: 'On divise par 3,6.',
      pieges: [
        [v * 3.6, 'Pour passer des km/h aux m/s, on divise par 3,6.'],
        [v / 60, 'Une heure compte 3600 s, et un kilomètre 1000 m.'],
        [(v * 1000) / 60, 'Une heure compte 3600 s, pas 60.'],
        [v / 1000, 'Il faut aussi convertir les heures en secondes.'],
      ],
    };
  }
  if (d === 2) {
    const v = pick(rng, [5, 10, 15, 20, 25, 340]);
    const r = v * 3.6;
    return {
      enonce: `Convertir ${donnee('v', v, M('m/s'))} en km/h.`,
      indice: '1 m/s = 3600 m/h = 3,6 km/h.',
      correction: [`$v = ${v} \\times 3{,}6 = ${qte(r, M('km/h'))}$.`],
      valeur: r,
      unite: M('km/h'),
      explication: 'On multiplie par 3,6.',
      pieges: [
        [v / 3.6, 'Pour passer des m/s aux km/h, on multiplie par 3,6.'],
        [v * 60, 'Une heure compte 3600 s, et il faut convertir les mètres en km.'],
        [v * 3600, 'Il faut aussi convertir les mètres en kilomètres (÷1000).'],
        [(v * 1000) / 3600, 'Conversion à l’envers.'],
      ],
    };
  }
  const rho = pick(rng, [0.8, 1, 2.7, 7.8, 11.3]);
  const r = rho * 1000;
  return {
    enonce: `Masse volumique ${donnee('\\rho', rho, M('g/cm^3'))} : la convertir en kg/m³.`,
    indice: '1 g = $10^{-3}$ kg et 1 cm³ = $10^{-6}$ m³.',
    correction: [`$1\\ \\mathrm{g/cm^3} = \\dfrac{10^{-3}\\ \\mathrm{kg}}{10^{-6}\\ \\mathrm{m^3}} = 1000\\ \\mathrm{kg/m^3}$.`, `$\\rho = ${qte(r, M('kg/m^3'))}$.`],
    valeur: r,
    unite: M('kg/m^3'),
    explication: 'On multiplie par 1000.',
    pieges: [
      [rho / 1000, 'Conversion à l’envers.'],
      [rho * 1e6, 'La masse aussi change d’unité : g → kg divise par 1000.'],
      [rho * 100, '1 m = 100 cm, mais 1 m³ = $10^6$ cm³.'],
      [rho, 'Les unités ont changé : la valeur numérique aussi.'],
    ],
  };
});

export const GENERATEURS_PHYSIQUE: readonly Generateur[] = [cinematique, dynamique, electrocinetique, energie, optique, oscillateurs, thermodynamique, unites];
