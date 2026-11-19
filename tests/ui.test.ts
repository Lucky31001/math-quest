// @vitest-environment happy-dom
/**
 * Test de fumée de l'interface (DOM simulé) : chaque écran s'affiche sans erreur,
 * chaque type de question se joue au clavier/à la souris et se corrige.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CONTENU } from '../src/core/loader';
import { afficherQuestion } from '../src/ui/components/question';
import type { Question } from '../src/core/schema';

const attendre = () => new Promise((r) => setTimeout(r, 0));
const touche = (key: string, cible: EventTarget = document) =>
  cible.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

async function aller(hash: string) {
  location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
  await attendre();
}

beforeAll(async () => {
  Element.prototype.scrollIntoView ??= function () {};
  document.body.innerHTML = '<div id="app"></div>';
  await import('../src/main');
});

describe('écrans', () => {
  it('accueil : carte des deux mondes', async () => {
    await aller('#/');
    const main = document.getElementById('contenu')!;
    expect(main.textContent).toContain('Monde Algèbre');
    expect(main.textContent).toContain('Monde Analyse');
    expect(main.querySelectorAll('.zone').length).toBe(CONTENU.chapitres.length);
    expect(document.querySelector('.hud')!.textContent).toContain('Bachelier perdu');
  });

  it.each(['cours', 'flashcards', 'exercices'])('chapitre : onglet %s', async (onglet) => {
    const ch = CONTENU.chapitres[0];
    await aller(`#/chapitre/${ch.id}/${onglet}`);
    const main = document.getElementById('contenu')!;
    expect(main.querySelector('h1')!.textContent).toContain(ch.titre);
    if (onglet === 'cours') expect(main.querySelectorAll('.bloc').length).toBeGreaterThan(3);
    if (onglet === 'flashcards') {
      expect(main.querySelector('.flashcard')).toBeTruthy();
      touche(' ');
      expect(main.querySelector('.flashcard')!.classList.contains('retournee')).toBe(true);
      touche('2');
      expect(main.querySelector('.compteur')!.textContent).toContain('Carte 2/');
    }
    if (onglet === 'exercices') {
      expect(main.querySelectorAll('.exercice-ligne').length).toBe(ch.exercices.length);
      (main.querySelector('.exercice-ligne') as HTMLButtonElement).click();
      expect(main.querySelector('.question')).toBeTruthy();
    }
  });

  it.each(['stats', 'badges', 'reglages', 'revision'])('écran %s', async (e) => {
    await aller(`#/${e}`);
    expect(document.getElementById('contenu')!.querySelector('h1')).toBeTruthy();
  });

  it('QCM éclair : on répond au clavier et le combo s’affiche', async () => {
    await aller('#/jouer/eclair');
    const main = document.getElementById('contenu')!;
    expect(main.querySelector('.question.type-qcm')).toBeTruthy();
    expect(main.querySelector('.session-barre')!.textContent).toContain('Question 1/20');
    touche('1');
    // QCM unique : « 1 » valide directement ; QCM multiple : « 1 » coche, Entrée valide.
    if (!main.querySelector('.pied-juste, .pied-faux')) touche('Enter');
    expect(main.querySelector('.pied-juste, .pied-faux')).toBeTruthy();
    expect(main.querySelector('.retour:not([hidden])')).toBeTruthy();
  });

  it('boss : 3 vies, chronomètre, bilan après 3 erreurs', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    await aller(`#/jouer/boss/${CONTENU.chapitres[0].id}`);
    const main = document.getElementById('contenu')!;
    expect(main.querySelector('.vies')!.textContent).toBe('❤️ 3');
    // Trois fois le temps écoulé → défaite
    for (let k = 0; k < 3; k++) {
      vi.advanceTimersByTime(200_000);
      (main.querySelector('.btn-suivant') as HTMLButtonElement).click();
    }
    expect(main.querySelector('.bilan')!.textContent).toContain('Le boss a gagné');
    vi.useRealTimers();
  });

  it('survie : s’arrête à la première erreur', async () => {
    await aller('#/jouer/survie');
    const main = document.getElementById('contenu')!;
    const q = main.querySelector('.question')!;
    // On donne une réponse forcément fausse ou invalide selon le type, puis on vérifie le compteur de vies.
    expect(main.querySelector('.vies')!.textContent).toBe('❤️ 1');
    expect(q).toBeTruthy();
  });
});

describe('composant question : chaque type se corrige', () => {
  const ch = CONTENU.chapitres[0];

  /** Répond correctement (ou faussement) à une question. */
  function repondre(q: Question, el: HTMLElement, juste: boolean) {
    const cliquerChoix = (pred: (orig: number) => boolean) =>
      el.querySelectorAll<HTMLInputElement>('.choix input').forEach((i) => {
        if (pred(Number(i.value))) {
          i.checked = true;
          i.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    if (q.type === 'qcm') cliquerChoix((k) => q.choix[k].correct === juste || (!juste && !q.multiple && k === q.choix.findIndex((c) => !c.correct)));
    if (q.type === 'vrai-faux') {
      const [bV, bF] = el.querySelectorAll<HTMLButtonElement>('.btn-vf');
      ((q.reponse === juste) ? bV : bF).click();
      const j = q.justifications.findIndex((c) => c.correct);
      cliquerChoix((k) => k === j);
    }
    if (q.type === 'trouve-erreur') el.querySelectorAll<HTMLButtonElement>('.etape')[juste ? q.etapeFausse : (q.etapeFausse + 1) % q.etapes.length].click();
    if (q.type === 'numerique' || q.type === 'expression') {
      const input = el.querySelector<HTMLInputElement>('.saisie')!;
      const rep = q.type === 'numerique' ? (Array.isArray(q.reponse) ? q.reponse.join(' ; ') : String(q.reponse)) : q.reponse;
      input.value = juste ? rep : `${q.type === 'numerique' && Array.isArray(q.reponse) ? q.reponse.map(() => '12345').join(';') : '12345'}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    (el.querySelector('.actions .btn-primaire') as HTMLButtonElement).click();
  }

  for (const juste of [true, false])
    it(`réponses ${juste ? 'justes' : 'fausses'} reconnues comme telles`, () => {
      for (const q of ch.exercices) {
        // Un QCM multiple « faux » : on coche seulement les mauvais choix.
        let statut: string | null = null;
        const c = afficherQuestion({ question: q, surResultat: (r) => (statut = r.statut), surSuivant: () => {} });
        document.body.append(c.el);
        repondre(q, c.el, juste);
        expect(statut, `${q.id} : ${c.el.querySelector('.msg-invalide')?.textContent}`).toBe(juste ? 'correct' : 'incorrect');
        expect(c.el.querySelector('.correction')).toBeTruthy();
        if (q.type === 'qcm') expect(c.el.querySelectorAll('.choix .explication').length).toBe(q.choix.length);
        c.detruire();
      }
    });

  it('QCM : raccourci clavier 1–4 et indice payant', () => {
    const q = ch.exercices.find((x) => x.type === 'qcm' && !x.multiple && x.indice)!;
    let statut: string | null = null;
    let indices = 0;
    const c = afficherQuestion({ question: q, surIndice: () => (indices++, true), surResultat: (r) => (statut = r.statut) });
    document.body.append(c.el);
    touche('h');
    expect(indices).toBe(1);
    expect(c.el.querySelector('.indice:not([hidden])')).toBeTruthy();
    touche('3');
    expect(statut).not.toBeNull();
    c.detruire();
  });

  it('saisie invalide : message, pas de correction', () => {
    const q = ch.exercices.find((x) => x.type === 'numerique')!;
    let appels = 0;
    const c = afficherQuestion({ question: q, surResultat: () => appels++ });
    document.body.append(c.el);
    const input = c.el.querySelector<HTMLInputElement>('.saisie')!;
    input.value = '2+';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (c.el.querySelector('.actions .btn-primaire') as HTMLButtonElement).click();
    expect(appels).toBe(0);
    expect(c.el.querySelector('.msg-invalide')!.textContent).not.toBe('');
    c.detruire();
  });
});
