/** Défi entre camarades : même sujet d'examen blanc, transmis par lien. */
import { describe, it, expect } from 'vitest';
import { encoderDefi, decoderDefi, PREFIXE_DEFI } from '../src/game/defi';
import { serieExamen, serieDepuisCles, cleItem } from '../src/game/series';
import { createRng } from '../src/core/random';
import { CONTENU } from './outils/contenu';

describe('défi entre camarades', () => {
  it('encode et décode la matière, les questions et la note (accents compris)', () => {
    const d = { matiere: 'physique', questions: ['cinematique/q1', 'gen~phys-energie~42~2'], note: 12.5 };
    const code = encoderDefi(d);
    expect(code.startsWith(PREFIXE_DEFI)).toBe(true);
    expect(code).toMatch(/^[\w-]+$/); // utilisable tel quel dans une URL
    expect(decoderDefi(code)).toEqual(d);
    expect(decoderDefi(encoderDefi({ matiere: 'é', questions: ['à/b'] }))).toEqual({ matiere: 'é', questions: ['à/b'], note: undefined });
  });

  it('refuse un code abîmé ou incohérent', () => {
    expect(decoderDefi('bonjour')).toBeNull();
    expect(decoderDefi(`${PREFIXE_DEFI}%%%`)).toBeNull();
    expect(decoderDefi(encoderDefi({ matiere: 'm', questions: [] }))).toBeNull();
    expect(decoderDefi(encoderDefi({ matiere: 'm', questions: ['a'], note: 25 }))?.note).toBeUndefined();
  });

  it('le camarade obtient exactement le même sujet (questions fixes et générées, dans l’ordre)', () => {
    const algebre = CONTENU.chapitres.filter((c) => c.monde === 'algebre');
    // Sujet avec des questions générées : on force le complément en demandant plus que le stock.
    const sujet = serieExamen([algebre[0]], createRng(5), algebre[0].exercices.length + 4);
    const cles = sujet.map(cleItem);
    expect(cles.filter((k) => k.startsWith('gen~'))).toHaveLength(4);
    const refait = serieDepuisCles(algebre, decoderDefi(encoderDefi({ matiere: 'algebre', questions: cles }))!.questions);
    expect(refait.map(cleItem)).toEqual(cles);
    expect(refait.map((i) => i.question)).toEqual(sujet.map((i) => i.question));
  });

  it('ignore les questions inconnues (contenu d’une autre version)', () => {
    const algebre = CONTENU.chapitres.filter((c) => c.monde === 'algebre');
    const k = `${algebre[0].id}/${algebre[0].exercices[0].id}`;
    expect(serieDepuisCles(algebre, [k, 'chapitre-disparu/q', 'gen~generateur-disparu~1~1']).map(cleItem)).toEqual([k]);
  });
});
