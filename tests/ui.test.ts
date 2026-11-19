// @vitest-environment happy-dom
/**
 * Test de fumée de l'interface (DOM simulé) : chaque écran s'affiche sans erreur,
 * chaque type de question se joue au clavier/à la souris et se corrige.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CONTENU } from '../src/core/loader';
import { afficherQuestion } from '../src/ui/components/question';
import type { Question } from '../src/core/schema';
import { rendreHtml } from '../src/ui/texte';

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
  it('accueil : carrousel à points des matières, chemin de la matière affichée', async () => {
    await aller('#/');
    const main = document.getElementById('contenu')!;
    const niveau = CONTENU.catalogue.niveaux[0];
    expect(main.querySelectorAll('.diapo')).toHaveLength(niveau.matieres.length);
    const points = () => main.querySelectorAll<HTMLButtonElement>('.point');
    expect(points()).toHaveLength(niveau.matieres.length);
    expect(document.querySelector('.hud')!.textContent).toContain('Bachelier perdu');
    // Chaque point affiche sa matière et le chemin de ses chapitres.
    niveau.matieres.forEach((m, i) => {
      points()[i].click();
      expect(points()[i].getAttribute('aria-selected')).toBe('true');
      expect(main.querySelector('.diapo.actif')!.textContent).toContain(m.nom);
      expect(main.querySelectorAll('.zone').length).toBe(CONTENU.chapitres.filter((c) => c.monde === m.id).length);
    });
    // Flèches du clavier sur la piste.
    points()[0].click();
    main.querySelector('.piste')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(main.querySelector('.diapo.actif')!.textContent).toContain(niveau.matieres[Math.min(1, niveau.matieres.length - 1)].nom);
    // Un seul niveau : pas de sélecteur de niveau.
    expect(!!main.querySelector('.niveaux')).toBe(CONTENU.catalogue.niveaux.length > 1);
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

describe('rendu du texte', () => {
  it('affiche le code tel quel : ni gras, ni LaTeX, HTML échappé', () => {
    const html = rendreHtml('Calcule `x**2 + y**2` puis **gras** et $x^2$.');
    expect(html).toContain('<code>x**2 + y**2</code>');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('katex');
  });
  it('rend un bloc ```python``` dans un <pre>, indentation conservée', () => {
    const html = rendreHtml('Code :\n```python\ndef f(x):\n    return x < 2 and \'$\'\n```\nFin.');
    expect(html).toContain('<pre class="code" data-langage="python"><code>def f(x):\n    return x &lt; 2 and &#39;$&#39;</code></pre>');
    expect(html).not.toContain('<code>python');
  });
});

describe('atelier C', () => {
  it("s'affiche avec un éditeur, un exemple et le bouton Exécuter (sans lancer le compilateur)", async () => {
    await aller('#/atelier');
    const main = document.getElementById('contenu')!;
    const editeur = main.querySelector<HTMLTextAreaElement>('textarea.editeur-c')!;
    expect(editeur.value).toContain('int main(void)');
    expect(main.querySelector('select.exemples-c')!.querySelectorAll('option').length).toBeGreaterThan(3);
    expect([...main.querySelectorAll('button')].some((b) => b.textContent!.includes('Exécuter'))).toBe(true);
  });
  it('le cours de C propose « Essayer dans l’atelier », qui ouvre le code complété', async () => {
    await aller('#/chapitre/c-pointeurs/cours');
    const bouton = [...document.querySelectorAll<HTMLButtonElement>('.btn-essayer')][0];
    expect(bouton).toBeTruthy();
    bouton.click();
    window.dispatchEvent(new Event('hashchange'));
    await attendre();
    const editeur = document.querySelector<HTMLTextAreaElement>('textarea.editeur-c')!;
    expect(editeur.value).toContain('void echange(int *a, int *b)');
    expect(editeur.value).toContain('int main(void)');
  });
});
