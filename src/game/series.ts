/**
 * Construction des séries de questions pour chaque mode de jeu.
 * Pur (pas de DOM) : prend le contenu, la progression et un générateur aléatoire.
 *
 * Dépend des générateurs (donc de math.js) : n'est importé que par les écrans
 * chargés à la demande (chapitre, séance). Voir modes.ts pour la partie légère.
 */
import type { Chapitre, Difficulte, Question } from '../core/schema';
import { cle } from '../core/loader';
import { shuffle, pick, type Rng } from '../core/random';
import { generateursDu, generer, generateurParId, GENERATEURS } from '../generators';
import type { Progression } from '../storage/progression';
import { estMaitrise } from './leitner';
import { EXAMEN, questionsDues, pointsFaibles, type ItemSession } from './modes';

const fixe = (chapitre: Chapitre, question: Question): ItemSession => ({ question, chapitre, cle: cle(chapitre.id, question.id) });

/** Une question générée pour ce chapitre (null si le chapitre n'a pas de générateur). */
export function itemGenere(chapitre: Chapitre, difficulte: Difficulte, rng: Rng, forme?: 'qcm' | 'libre'): ItemSession | null {
  let gens = generateursDu(chapitre.id);
  if (forme) gens = gens.filter((g) => g.formes.includes(forme));
  if (!gens.length) return null;
  const g = pick(rng, gens);
  return { question: generer(g, difficulte, forme, Math.floor(rng() * 2 ** 31)), chapitre, cle: null };
}

/**
 * Entraînement sur un chapitre : jusqu'à 10 questions, en priorité les questions
 * fixes pas encore maîtrisées, complétées par des questions générées.
 */
export function serieEntrainement(chapitre: Chapitre, p: Progression, difficulte: Difficulte | null, rng: Rng, n = 10): ItemSession[] {
  const fixes = chapitre.exercices.filter((q) => difficulte === null || q.difficulte === difficulte);
  const [aTravailler, maitrisees] = [
    fixes.filter((q) => !estMaitrise(p.questions[cle(chapitre.id, q.id)])),
    fixes.filter((q) => estMaitrise(p.questions[cle(chapitre.id, q.id)])),
  ];
  const nbGen = generateursDu(chapitre.id).length ? Math.max(3, n - aTravailler.length) : 0;
  const choisies = [...shuffle(aTravailler, rng), ...shuffle(maitrisees, rng)].slice(0, n - Math.min(nbGen, 3));
  const items = choisies.map((q) => fixe(chapitre, q));
  while (items.length < n) {
    const g = itemGenere(chapitre, difficulte ?? pick(rng, [1, 2, 3] as const), rng);
    if (!g) break;
    items.push(g);
  }
  return shuffle(items, rng);
}

/** Boss de fin de chapitre : 10 questions dont 6 QCM, plutôt difficiles. */
export function serieBoss(chapitre: Chapitre, rng: Rng): ItemSession[] {
  const diff = (): Difficulte => pick(rng, [2, 2, 3] as const);
  const qcmFixes = shuffle(chapitre.exercices.filter((q) => q.type === 'qcm'), rng);
  // Pas d'exercice « programme » sous le chronomètre du boss.
  const autresFixes = shuffle(chapitre.exercices.filter((q) => q.type !== 'qcm' && q.type !== 'programme'), rng);
  const items: ItemSession[] = [];
  // 6 QCM : moitié fixes, moitié générés (si possible)
  for (let i = 0; i < 6; i++) {
    const gen = i % 2 === 1 ? itemGenere(chapitre, diff(), rng, 'qcm') : null;
    const q = gen ?? (qcmFixes.length ? fixe(chapitre, qcmFixes.pop()!) : itemGenere(chapitre, diff(), rng, 'qcm'));
    if (q) items.push(q);
  }
  // 4 autres questions
  for (let i = 0; i < 4; i++) {
    const gen = i % 2 === 1 ? itemGenere(chapitre, diff(), rng, 'libre') : null;
    const q = gen ?? (autresFixes.length ? fixe(chapitre, autresFixes.pop()!) : itemGenere(chapitre, diff(), rng, 'libre'));
    if (q) items.push(q);
  }
  // Compléter avec ce qu'il reste si le chapitre est petit.
  const reste = shuffle([...qcmFixes, ...autresFixes], rng);
  while (items.length < 10 && reste.length) items.push(fixe(chapitre, reste.pop()!));
  return shuffle(items, rng);
}

/** Durée (s) accordée pour une question en mode Boss. */
export const dureeBoss = (q: Question): number => (q.type === 'qcm' ? 45 : q.type === 'vrai-faux' || q.type === 'trouve-erreur' ? 60 : 90) + (q.difficulte === 3 ? 30 : 0);

/** Survie : une question au hasard parmi tous les chapitres, de plus en plus difficile. */
export function itemSurvie(chapitres: readonly Chapitre[], rang: number, rng: Rng): ItemSession {
  const difficulte: Difficulte = rang < 5 ? 1 : rang < 15 ? 2 : 3;
  const chapitre = pick(rng, chapitres);
  // Survie : questions rapides, sans exercice « programme ».
  const rapides = chapitre.exercices.filter((q) => q.type !== 'programme');
  const fixes = rapides.filter((q) => q.difficulte <= difficulte);
  if (rng() < 0.5 || !fixes.length) {
    const g = itemGenere(chapitre, difficulte, rng);
    if (g) return g;
  }
  return fixe(chapitre, pick(rng, fixes.length ? fixes : rapides));
}

/** QCM éclair : 20 QCM de tous les chapitres (fixes et générés). */
export function serieEclair(chapitres: readonly Chapitre[], rng: Rng, n = 20): ItemSession[] {
  const fixes = shuffle(
    chapitres.flatMap((c) => c.exercices.filter((q) => q.type === 'qcm').map((q) => fixe(c, q))),
    rng,
  );
  const items: ItemSession[] = [];
  // Seulement les générateurs dont le chapitre est chargé.
  const gens = GENERATEURS.filter((g) => g.formes.includes('qcm') && chapitres.some((c) => c.id === g.chapitre));
  while (items.length < n) {
    if ((items.length % 3 === 2 || !fixes.length) && gens.length) {
      const g = pick(rng, gens);
      const chapitre = chapitres.find((c) => c.id === g.chapitre)!;
      items.push({ question: generer(g, pick(rng, [1, 2] as const), 'qcm', Math.floor(rng() * 2 ** 31)), chapitre, cle: null });
      continue;
    }
    if (!fixes.length) break;
    items.push(fixes.pop()!);
  }
  return items;
}

/**
 * Examen blanc d'une matière : questions fixes de tous ses chapitres, réparties
 * équitablement (tour à tour), sans exercice « programme » ; complété par des
 * questions générées si la matière en a trop peu.
 */
export function serieExamen(chapitres: readonly Chapitre[], rng: Rng, n: number = EXAMEN.questions): ItemSession[] {
  const piles = shuffle(chapitres, rng).map((c) => ({ c, qs: shuffle(c.exercices.filter((q) => q.type !== 'programme'), rng) }));
  const items: ItemSession[] = [];
  while (items.length < n && piles.some((p) => p.qs.length))
    for (const p of piles) {
      const q = p.qs.pop();
      if (q && items.length < n) items.push(fixe(p.c, q));
    }
  for (let essais = 0; items.length < n && essais < 10 * n; essais++) {
    const g = itemGenere(pick(rng, chapitres), pick(rng, [1, 2, 3] as const), rng);
    if (g) items.push(g);
  }
  return shuffle(items, rng);
}

/**
 * Révision du jour : questions dues ; s'il n'y en a pas assez, on complète avec
 * le chapitre le plus faible (taux de réussite le plus bas parmi ceux déjà travaillés).
 */
export function serieRevision(chapitres: readonly Chapitre[], p: Progression, aujourdhui: string, rng: Rng, n = 10): ItemSession[] {
  const items: ItemSession[] = questionsDues(chapitres, p, aujourdhui, n);
  if (items.length >= n) return items;
  const faible = pointsFaibles(chapitres, p)[0];
  if (faible) {
    const deja = new Set(items.map((i) => i.cle));
    const extra = serieEntrainement(faible.chapitre, p, null, rng, n - items.length).filter((i) => !i.cle || !deja.has(i.cle));
    items.push(...extra);
  }
  return items;
}

/** Clé d'un élément de série : clé Leitner d'une question fixe, ou identifiant d'une question générée. */
export const cleItem = (i: ItemSession): string => i.cle ?? i.question.id;

/**
 * Reconstitue un sujet à partir de ses clés (défi entre camarades), dans
 * l'ordre. Les questions générées sont régénérées à l'identique depuis leur
 * identifiant « gen~<générateur>~<graine>~<difficulté> ». Les clés inconnues
 * (contenu d'une autre version) sont ignorées.
 */
export function serieDepuisCles(chapitres: readonly Chapitre[], cles: readonly string[]): ItemSession[] {
  return cles.flatMap((k): ItemSession[] => {
    const gen = /^gen~([^~]+)~(\d+)~([123])$/.exec(k);
    if (gen) {
      const g = generateurParId(gen[1]);
      const chapitre = chapitres.find((c) => c.id === g?.chapitre);
      if (!g || !chapitre) return [];
      return [{ question: generer(g, Number(gen[3]) as Difficulte, undefined, Number(gen[2])), chapitre, cle: null }];
    }
    const [idChap, idQ] = k.split('/');
    const chapitre = chapitres.find((c) => c.id === idChap);
    const question = chapitre?.exercices.find((q) => q.id === idQ);
    return chapitre && question ? [fixe(chapitre, question)] : [];
  });
}

