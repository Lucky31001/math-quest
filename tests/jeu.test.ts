/** Tests de la logique de jeu : Leitner, XP/niveaux, streak, progression, badges, modes. */
import { describe, it, expect } from 'vitest';
import { apresReponse, estDue, INTERVALLES } from '../src/game/leitner';
import { niveauDepuisXp, seuilNiveau, titre, pointsEclair } from '../src/game/xp';
import { ajouterJours, ecartJours } from '../src/game/dates';
import { majStreak, streakActuel, enregistrerReponse, payerIndice, enregistrerFlashcard, validerSerie } from '../src/game/progres';
import { progressionVide, importer, exporter, charger } from '../src/storage/progression';
import { listeBadges, nouveauxBadges } from '../src/game/badges';
import { CONTENU, toutesLesMatieres } from '../src/core/loader';
import { serieBoss, serieEclair, serieEntrainement, questionsDues, itemSurvie } from '../src/game/modes';
import { createRng } from '../src/core/random';

const J = '2026-03-10';

describe('dates', () => {
  it('ajoute des jours en traversant les mois', () => {
    expect(ajouterJours('2026-01-31', 1)).toBe('2026-02-01');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
    expect(ecartJours('2026-02-27', '2026-03-02')).toBe(3);
  });
});

describe('Leitner', () => {
  it('fait monter d’une boîte à chaque réussite, avec des intervalles croissants', () => {
    let e = apresReponse(undefined, true, J);
    expect(e.boite).toBe(2);
    expect(e.prochaine).toBe(ajouterJours(J, INTERVALLES[2]));
    e = apresReponse(e, true, J);
    expect(e.boite).toBe(3);
    for (let i = 0; i < 5; i++) e = apresReponse(e, true, J);
    expect(e.boite).toBe(5);
  });
  it('renvoie en boîte 1, à revoir le jour même, après une erreur', () => {
    let e = apresReponse(undefined, true, J);
    e = apresReponse(e, true, J);
    e = apresReponse(e, false, J);
    expect(e.boite).toBe(1);
    expect(estDue(e, J)).toBe(true);
    expect(e.vues).toBe(3);
    expect(e.reussites).toBe(2);
  });
  it('n’est pas due avant la date prévue', () => {
    const e = apresReponse(undefined, true, J);
    expect(estDue(e, J)).toBe(false);
    expect(estDue(e, ajouterJours(J, 2))).toBe(true);
  });
});

describe('XP et niveaux', () => {
  it('calcule le niveau à partir des seuils', () => {
    expect(niveauDepuisXp(0).niveau).toBe(1);
    expect(niveauDepuisXp(99).niveau).toBe(1);
    expect(niveauDepuisXp(100).niveau).toBe(2);
    expect(niveauDepuisXp(seuilNiveau(7)).niveau).toBe(7);
    const n = niveauDepuisXp(150);
    expect(n.xpDansNiveau).toBe(50);
    expect(n.xpPourSuivant).toBe(200);
  });
  it('fait évoluer le titre', () => {
    expect(titre(1)).toBe('Bachelier perdu');
    expect(titre(7)).toBe("Dompteur d'epsilons");
    expect(titre(17)).toBe('Maître des DL');
  });
  it('plafonne le bonus de combo en QCM éclair', () => {
    expect(pointsEclair(1)).toBe(100);
    expect(pointsEclair(3)).toBe(150);
    expect(pointsEclair(50)).toBe(200);
  });
});

describe('streak', () => {
  it('augmente les jours consécutifs, repart à 1 après un trou', () => {
    const p = progressionVide();
    majStreak(p, '2026-03-01');
    majStreak(p, '2026-03-01');
    majStreak(p, '2026-03-02');
    majStreak(p, '2026-03-03');
    expect(p.streak.courant).toBe(3);
    expect(streakActuel(p, '2026-03-04')).toBe(3); // pas encore perdu
    expect(streakActuel(p, '2026-03-05')).toBe(0); // un jour sauté
    majStreak(p, '2026-03-06');
    expect(p.streak.courant).toBe(1);
    expect(p.streak.record).toBe(3);
  });
});

describe('streak : seules les séries terminées comptent', () => {
  it('une réponse ou une flashcard isolée ne fait pas avancer le streak', () => {
    const p = progressionVide();
    enregistrerReponse(p, { chapitre: 'c', cle: null, type: 'qcm', difficulte: 1, correct: true }, J);
    enregistrerFlashcard(p, 'c/f', true, J);
    expect(p.streak.courant).toBe(0);
    expect(p.streak.dernierJour).toBeNull();
  });
  it('terminer une série le fait avancer, une seule fois par jour', () => {
    const p = progressionVide();
    expect(validerSerie(p, '2026-03-01')).toBe(true);
    expect(validerSerie(p, '2026-03-01')).toBe(false);
    expect(p.streak.courant).toBe(1);
    expect(validerSerie(p, '2026-03-02')).toBe(true);
    expect(p.streak.courant).toBe(2);
    expect(p.compteurs.series).toBe(3);
  });
});

describe('enregistrement des réponses', () => {
  it('donne des XP selon la difficulté et met à jour stats et Leitner', () => {
    const p = progressionVide();
    const gain = enregistrerReponse(p, { chapitre: 'complexes', cle: 'complexes/q1', type: 'qcm', difficulte: 2, correct: true }, J);
    expect(gain).toBe(20);
    expect(p.xp).toBe(20);
    expect(p.questions['complexes/q1'].boite).toBe(2);
    expect(p.stats.complexes.qcm).toEqual({ tentatives: 1, reussites: 1 });
    expect(p.compteurs.qcmReussis).toBe(1);
    expect(enregistrerReponse(p, { chapitre: 'complexes', cle: null, type: 'numerique', difficulte: 3, correct: false }, J)).toBe(0);
    expect(p.stats.complexes.numerique).toEqual({ tentatives: 1, reussites: 0 });
    expect(p.journal[J]).toBe(2);
  });
  it('applique le multiplicateur', () => {
    const p = progressionVide();
    expect(enregistrerReponse(p, { chapitre: 'c', cle: null, type: 'qcm', difficulte: 1, correct: true, multiplicateur: 1.5 }, J)).toBe(15);
  });
  it('fait payer les indices sans descendre sous 0 XP', () => {
    const p = progressionVide();
    p.xp = 3;
    expect(payerIndice(p)).toBe(3);
    expect(p.xp).toBe(0);
    expect(p.compteurs.indices).toBe(1);
  });
  it('gère les flashcards', () => {
    const p = progressionVide();
    expect(enregistrerFlashcard(p, 'c/f', true, J)).toBeGreaterThan(0);
    expect(p.flashcards['c/f'].boite).toBe(2);
  });
});

describe('sauvegarde', () => {
  it('exporte puis réimporte à l’identique', () => {
    const p = progressionVide();
    enregistrerReponse(p, { chapitre: 'complexes', cle: 'complexes/q1', type: 'qcm', difficulte: 2, correct: true }, J);
    const r = importer(exporter(p));
    expect(r.ok && r.progression).toEqual(p);
  });
  it('refuse un fichier invalide avec un message', () => {
    expect(importer('pas du json').ok).toBe(false);
    expect(importer('{"progression": {"xp": -5}}').ok).toBe(false);
  });
  it('complète une ancienne sauvegarde avec les valeurs par défaut', () => {
    const r = importer('{"xp": 42}');
    expect(r.ok && r.progression.xp).toBe(42);
    expect(r.ok && r.progression.reglages.sons).toBe(true);
  });
  it('résiste à un localStorage corrompu', () => {
    expect(charger({ getItem: () => '{oups', setItem: () => {} }).xp).toBe(0);
    expect(charger({ getItem: () => null, setItem: () => {} }).xp).toBe(0);
  });
});

describe('badges', () => {
  const badges = listeBadges(CONTENU.chapitres, toutesLesMatieres());
  it('ont des identifiants uniques', () => {
    expect(new Set(badges.map((b) => b.id)).size).toBe(badges.length);
  });
  it('se débloquent une seule fois', () => {
    const p = progressionVide();
    p.compteurs.bonnes = 1;
    p.streak.record = 7;
    const n1 = nouveauxBadges(p, badges, J).map((b) => b.id);
    expect(n1).toContain('premiers-pas');
    expect(n1).toContain('streak-7');
    expect(nouveauxBadges(p, badges, J)).toEqual([]);
  });
  it('« 100 % sur un chapitre » exige toutes ses questions', () => {
    const ch = CONTENU.chapitres[0];
    const p = progressionVide();
    const id = `parfait-${ch.id}`;
    ch.exercices.slice(1).forEach((q) => enregistrerReponse(p, { chapitre: ch.id, cle: `${ch.id}/${q.id}`, type: q.type, difficulte: q.difficulte, correct: true }, J));
    expect(nouveauxBadges(p, badges, J).map((b) => b.id)).not.toContain(id);
    const q = ch.exercices[0];
    enregistrerReponse(p, { chapitre: ch.id, cle: `${ch.id}/${q.id}`, type: q.type, difficulte: q.difficulte, correct: true }, J);
    expect(nouveauxBadges(p, badges, J).map((b) => b.id)).toContain(id);
  });
  it('« Aucun indice utilisé » exige un boss vaincu sans indice', () => {
    const p = progressionVide();
    p.records.boss.x = { meilleur: 10, vaincu: true, sansIndice: false };
    expect(nouveauxBadges(p, badges, J).map((b) => b.id)).not.toContain('sans-indice');
    p.records.boss.x.sansIndice = true;
    expect(nouveauxBadges(p, badges, J).map((b) => b.id)).toContain('sans-indice');
  });
});

describe('modes de jeu', () => {
  const ch = CONTENU.chapitres[0];
  it('boss : 10 questions dont une majorité de QCM', () => {
    for (let s = 0; s < 20; s++) {
      const l = serieBoss(ch, createRng(s));
      expect(l).toHaveLength(10);
      expect(l.filter((i) => i.question.type === 'qcm').length).toBeGreaterThanOrEqual(6);
    }
  });
  it('QCM éclair : 20 QCM', () => {
    const l = serieEclair(CONTENU.chapitres, createRng(1));
    expect(l).toHaveLength(20);
    expect(l.every((i) => i.question.type === 'qcm')).toBe(true);
  });
  it('entraînement : 10 questions sans doublon', () => {
    const l = serieEntrainement(ch, progressionVide(), null, createRng(3));
    expect(l).toHaveLength(10);
    const ids = l.map((i) => i.question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('survie : la difficulté augmente', () => {
    const rng = createRng(5);
    expect(itemSurvie(CONTENU.chapitres, 0, rng).question.difficulte).toBe(1);
    for (let i = 0; i < 20; i++) expect(itemSurvie(CONTENU.chapitres, 30, rng).question.difficulte).toBeGreaterThanOrEqual(1);
  });
  it('révision : seules les questions dues sont proposées, les plus fragiles d’abord', () => {
    const p = progressionVide();
    const [q1, q2, q3] = ch.exercices;
    const k = (id: string) => `${ch.id}/${id}`;
    enregistrerReponse(p, { chapitre: ch.id, cle: k(q1.id), type: q1.type, difficulte: 1, correct: true }, J); // due dans 2 j
    enregistrerReponse(p, { chapitre: ch.id, cle: k(q2.id), type: q2.type, difficulte: 1, correct: false }, J); // due aujourd'hui
    enregistrerReponse(p, { chapitre: ch.id, cle: k(q3.id), type: q3.type, difficulte: 1, correct: true }, J);
    enregistrerReponse(p, { chapitre: ch.id, cle: k(q3.id), type: q3.type, difficulte: 1, correct: false }, J);
    expect(questionsDues(CONTENU.chapitres, p, J).map((i) => i.cle)).toEqual([k(q2.id), k(q3.id)]);
    expect(questionsDues(CONTENU.chapitres, p, ajouterJours(J, 2)).map((i) => i.cle)).toContain(k(q1.id));
  });
});

describe('sauvegarde illisible', () => {
  it('conserve une copie brute au lieu de la perdre', () => {
    const ecrit: Record<string, string> = {};
    const stock = { getItem: () => '{"xp": -5}', setItem: (k: string, v: string) => void (ecrit[k] = v) };
    expect(charger(stock).xp).toBe(0);
    expect(Object.values(ecrit)).toEqual(['{"xp": -5}']);
  });
});
