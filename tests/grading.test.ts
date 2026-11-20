import { describe, it, expect } from 'vitest';
import { corriger, corrigerQcm } from '../src/core/grading';
import { QuestionSchema, type Qcm, type Question } from '../src/core/schema';

const choix = (correct: boolean, texte = 'x') => ({ texte, correct, explication: 'e' });

const qcmUnique: Qcm = QuestionSchema.parse({
  id: 'u',
  type: 'qcm',
  difficulte: 1,
  enonce: '?',
  correction: ['c'],
  choix: [choix(false, 'a'), choix(true, 'b'), choix(false, 'c'), choix(false, 'd')],
}) as Qcm;

const qcmMultiple: Qcm = QuestionSchema.parse({
  id: 'm',
  type: 'qcm',
  multiple: true,
  difficulte: 2,
  enonce: '?',
  correction: ['c'],
  choix: [choix(true, 'a'), choix(false, 'b'), choix(true, 'c'), choix(false, 'd')],
}) as Qcm;

describe('QCM à réponse unique', () => {
  it('juste uniquement sur la bonne réponse', () => {
    expect(corrigerQcm(qcmUnique, [1]).statut).toBe('correct');
    expect(corrigerQcm(qcmUnique, [0]).statut).toBe('incorrect');
    expect(corrigerQcm(qcmUnique, [3]).statut).toBe('incorrect');
  });
  it('refuse zéro ou plusieurs réponses', () => {
    expect(corrigerQcm(qcmUnique, []).statut).toBe('invalide');
    expect(corrigerQcm(qcmUnique, [1, 2]).statut).toBe('invalide');
    expect(corrigerQcm(qcmUnique, [7]).statut).toBe('invalide');
  });
});

describe('QCM à réponses multiples', () => {
  it('exige toutes les bonnes réponses et aucune mauvaise', () => {
    expect(corrigerQcm(qcmMultiple, [0, 2]).statut).toBe('correct');
    expect(corrigerQcm(qcmMultiple, [2, 0]).statut).toBe('correct');
    // Une bonne oubliée
    expect(corrigerQcm(qcmMultiple, [0]).statut).toBe('incorrect');
    // Toutes les bonnes + une mauvaise
    expect(corrigerQcm(qcmMultiple, [0, 1, 2]).statut).toBe('incorrect');
    // Tout coché
    expect(corrigerQcm(qcmMultiple, [0, 1, 2, 3]).statut).toBe('incorrect');
  });
  it('compte les choix bien traités', () => {
    expect(corrigerQcm(qcmMultiple, [0]).bienTraites).toBe(3);
    expect(corrigerQcm(qcmMultiple, [1, 3]).bienTraites).toBe(0);
  });
  it('notation en partie juste : bonnes cochées − mauvaises cochées, sur le nombre de bonnes', () => {
    expect(corrigerQcm(qcmMultiple, [0, 2]).credit).toBe(1);
    expect(corrigerQcm(qcmMultiple, [0])).toMatchObject({ statut: 'incorrect', credit: 0.5 });
    expect(corrigerQcm(qcmMultiple, [0, 1]).credit).toBe(0); // une bonne, une mauvaise
    expect(corrigerQcm(qcmMultiple, [0, 1, 2]).credit).toBe(0.5); // tout bon + une mauvaise
    expect(corrigerQcm(qcmMultiple, [0, 1, 2, 3]).credit).toBe(0); // tout cocher ne rapporte rien
    expect(corrigerQcm(qcmMultiple, [1, 3]).credit).toBe(0); // jamais négatif
  });
  it('pas de partie juste pour un QCM à réponse unique', () => {
    expect(corrigerQcm(qcmUnique, [0]).credit).toBe(0);
    expect(corrigerQcm(qcmUnique, [1]).credit).toBe(1);
  });
});

describe('validation du schéma', () => {
  it('refuse un QCM unique à deux bonnes réponses', () => {
    const r = QuestionSchema.safeParse({ ...qcmUnique, choix: [choix(true), choix(true)] });
    expect(r.success).toBe(false);
  });
  it('refuse un QCM multiple sans bonne réponse', () => {
    const r = QuestionSchema.safeParse({ ...qcmMultiple, choix: [choix(false), choix(false)] });
    expect(r.success).toBe(false);
  });
  it('refuse une étape fausse hors limites', () => {
    const r = QuestionSchema.safeParse({ id: 't', type: 'trouve-erreur', difficulte: 1, enonce: '?', correction: ['c'], etapes: ['a', 'b'], etapeFausse: 2, explication: 'e' });
    expect(r.success).toBe(false);
  });
  it('refuse un champ inconnu (faute de frappe)', () => {
    const r = QuestionSchema.safeParse({ ...qcmUnique, enoncee: 'oups' });
    expect(r.success).toBe(false);
  });
});

describe('corriger() — tous les types', () => {
  const vf = QuestionSchema.parse({
    id: 'vf',
    type: 'vrai-faux',
    difficulte: 1,
    enonce: 'Toute suite bornée converge.',
    correction: ['c'],
    reponse: false,
    justifications: [choix(true, 'contre-exemple'), choix(false, 'monotone')],
  }) as Question;
  it('vrai/faux : valeur ET justification', () => {
    expect(corriger(vf, { type: 'vrai-faux', valeur: false, justification: 0 }).statut).toBe('correct');
    const r = corriger(vf, { type: 'vrai-faux', valeur: false, justification: 1 });
    expect(r.statut).toBe('incorrect');
    expect(r.partiel).toBe(true);
    expect(corriger(vf, { type: 'vrai-faux', valeur: true, justification: 1 }).partiel).toBe(false);
  });
  it('trouve l’erreur', () => {
    const te = QuestionSchema.parse({ id: 'te', type: 'trouve-erreur', difficulte: 1, enonce: '?', correction: ['c'], etapes: ['a', 'b', 'c'], etapeFausse: 1, explication: 'e' }) as Question;
    expect(corriger(te, { type: 'trouve-erreur', etape: 1 }).statut).toBe('correct');
    expect(corriger(te, { type: 'trouve-erreur', etape: 2 }).statut).toBe('incorrect');
  });
  it('numérique et expression passent par le checker', () => {
    const num = QuestionSchema.parse({ id: 'n', type: 'numerique', difficulte: 1, enonce: '?', correction: ['c'], reponse: '1/3' }) as Question;
    expect(corriger(num, { type: 'numerique', saisie: '2/6' }).statut).toBe('correct');
    const ex = QuestionSchema.parse({ id: 'e', type: 'expression', difficulte: 1, enonce: '?', correction: ['c'], reponse: '2*x*exp(x^2)' }) as Question;
    expect(corriger(ex, { type: 'expression', saisie: '2x e^(x^2)' }).statut).toBe('correct');
  });
  it('refuse une réponse du mauvais type', () => {
    expect(() => corriger(qcmUnique, { type: 'numerique', saisie: '1' })).toThrow();
  });
});
