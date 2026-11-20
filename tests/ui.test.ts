// @vitest-environment happy-dom
/**
 * Test de fumée de l'interface (DOM simulé) : chaque écran s'affiche sans erreur,
 * chaque type de question se joue au clavier/à la souris et se corrige.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CONTENU } from './outils/contenu';
import { afficherQuestion } from '../src/ui/components/question';
import type { Question, Programme } from '../src/core/schema';
import { readFileSync } from 'node:fs';
import { chargerCompilateur, compiler, executer, type Compilateur } from '../src/c/compilateur';
import type { IssueTests } from '../src/c/client';
import { rendreHtml } from '../src/ui/texte';

const attendre = () => new Promise((r) => setTimeout(r, 0));
const touche = (key: string, cible: EventTarget = document) =>
  cible.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

/** Navigue, puis attend la fin du chargement des chapitres complets (écrans asynchrones). */
async function aller(hash: string) {
  location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
  await attendre();
  await vi.waitFor(() => {
    const main = document.getElementById('contenu')!;
    if (main.querySelector('.chargement') || !main.children.length) throw new Error('chargement en cours');
  });
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

  it('réglages : état de la protection de la sauvegarde', async () => {
    await aller('#/reglages');
    await attendre();
    const bloc = document.querySelector('#contenu .protection')!;
    expect(bloc).toBeTruthy();
    expect(bloc.textContent).toContain('Dernier export');
  });

  it('transfert : lien + QR dans les réglages, puis réception et import sur « l’autre appareil »', async () => {
    const { etat } = await import('../src/ui/etat');
    const avant = structuredClone(etat.p);
    await aller('#/reglages');
    const creer = [...document.querySelectorAll<HTMLButtonElement>('#contenu button')].find((b) => b.textContent!.includes('Créer un lien'))!;
    creer.click();
    await vi.waitFor(() => expect(document.querySelector<HTMLTextAreaElement>('.zone-transfert .lien-transfert')).toBeTruthy());
    const lien = document.querySelector<HTMLTextAreaElement>('.zone-transfert .lien-transfert')!.value;
    expect(lien).toContain('#/transfert/MQ1-');
    expect(document.querySelector('.qr-transfert svg')).toBeTruthy();

    // « Autre appareil » : une progression différente est reçue.
    const { encoderTransfert } = await import('../src/storage/transfert');
    const recue = structuredClone(avant);
    recue.xp = avant.xp + 777;
    await aller(`#/transfert/${encoderTransfert(recue)}`);
    expect(document.querySelector('.table-transfert')!.textContent).toContain(`${recue.xp} XP`);
    const confirmOrigine = window.confirm; // absent du DOM simulé
    window.confirm = () => true;
    [...document.querySelectorAll<HTMLButtonElement>('#contenu button')].find((b) => b.textContent!.includes('Importer'))!.click();
    expect(etat.p.xp).toBe(recue.xp);
    expect(location.hash).toBe('#/');
    window.confirm = confirmOrigine;
    etat.remplacer(avant);
  });

  it('transfert : un code abîmé affiche une erreur, sans rien importer', async () => {
    await aller('#/transfert/MQ1-abime');
    expect(document.querySelector('#contenu [role=alert]')!.textContent).toMatch(/incomplet|abîmé/);
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

describe('examen blanc', () => {
  /** Une réponse quelconque (mais complète), quel que soit le type de question. */
  function repondreAuHasard(q: HTMLElement) {
    const changer = (e: HTMLInputElement) => {
      e.checked = true;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (q.classList.contains('type-vrai-faux')) q.querySelector<HTMLButtonElement>('.btn-vf')!.click();
    if (q.classList.contains('type-trouve-erreur')) q.querySelector<HTMLButtonElement>('.etape')!.click();
    const choix = q.querySelector<HTMLInputElement>('.choix input');
    if (choix) changer(choix);
    const saisie = q.querySelector<HTMLInputElement>('.saisie');
    if (saisie) {
      const n = Number(/(\d+) valeurs attendues/.exec(q.textContent ?? '')?.[1] ?? 1);
      saisie.value = Array(n).fill(q.classList.contains('type-expression') ? 'x' : '1').join(';');
      saisie.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  it('20 questions sans correction ni XP pendant l’épreuve, puis note sur 20 et copie corrigée', async () => {
    const { etat } = await import('../src/ui/etat');
    const avant = structuredClone(etat.p);
    await aller('#/jouer/examen/algebre');
    const main = document.getElementById('contenu')!;
    expect(main.querySelector('.session-titre')!.textContent).toContain('Examen blanc');
    for (let i = 0; i < 20; i++) {
      const q = main.querySelector<HTMLElement>('.session-scene .question')!;
      repondreAuHasard(q);
      q.querySelector<HTMLButtonElement>('.actions .btn-primaire')!.click();
      expect(q.querySelector('.msg-invalide')!.textContent, `question ${i + 1}`).toBe('');
      expect(q.querySelector('.correction'), 'pas de correction pendant l’examen').toBeNull();
      expect(q.querySelector('.verdict')!.textContent).toBe('Réponse enregistrée');
      expect(etat.p.xp, 'XP enregistrés seulement à la fin').toBe(avant.xp);
      q.querySelector<HTMLButtonElement>('.btn-suivant')!.click();
    }
    expect(main.querySelector('.bilan h2')!.textContent).toMatch(/^📝 [\d,]+\/20$/);
    const copie = main.querySelectorAll('.copie .question.en-revue');
    expect(copie).toHaveLength(20);
    copie.forEach((q) => {
      expect(q.querySelector('.correction')).toBeTruthy();
      expect(q.querySelector('.btn-suivant'), 'pas de « Continuer » dans la copie').toBeNull();
    });
    expect(etat.p.records.examens.algebre).toBeGreaterThanOrEqual(0);
    expect(etat.p.compteurs.reponses).toBe(avant.compteurs.reponses + 20);
    etat.remplacer(avant);
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

describe('exercice « programme » (compilateur C réel, sans worker)', () => {
  const ch = CONTENU.chapitres.find((c) => c.exercices.some((q) => q.type === 'programme'))!;
  const q = ch.exercices.find((x): x is Programme => x.type === 'programme')!;
  let xcc: Compilateur;
  beforeAll(() => {
    xcc = chargerCompilateur(new Uint8Array(readFileSync('public/compilateur-c/wccfiles.zip')));
  });
  const executeur = async (source: string, entrees: string[]): Promise<IssueTests> => {
    const r = compiler(xcc, source);
    if (!('module' in r)) return { compilation: r.messages };
    return {
      sorties: entrees.map((entree) => {
        let sortie = '';
        executer(r.module, { entree, sortie: (t) => (sortie += t) });
        return { sortie, code: 0 };
      }),
    };
  };
  async function jouer(code: string) {
    const statuts: string[] = [];
    const c = afficherQuestion({ question: q, executeur, surResultat: (r) => statuts.push(r.statut), surSuivant: () => {} });
    document.body.append(c.el);
    const editeur = c.el.querySelector<HTMLTextAreaElement>('textarea.editeur-c')!;
    expect(editeur.value).toBe(q.code);
    editeur.value = code;
    editeur.dispatchEvent(new Event('input', { bubbles: true }));
    (c.el.querySelector('.actions .btn-primaire') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(statuts.length + (c.el.querySelector('.msg-invalide')!.textContent ? 1 : 0)).toBeGreaterThan(0), { timeout: 20_000 });
    return { c, statuts };
  }

  it('solution juste : tous les tests passent, la solution est montrée', { timeout: 30_000 }, async () => {
    const { c, statuts } = await jouer(q.solution);
    expect(statuts).toEqual(['correct']);
    expect(c.el.querySelectorAll('.tests-c .test-ok')).toHaveLength(q.tests.length);
    expect(c.el.querySelector('.solution-c')).toBeTruthy();
    c.detruire();
  });

  it('code faux : tests échoués, sortie attendue et obtenue affichées', { timeout: 30_000 }, async () => {
    const { c, statuts } = await jouer(q.code);
    expect(statuts).toEqual(['incorrect']);
    expect(c.el.querySelector('.tests-c .test-ko')).toBeTruthy();
    expect(c.el.querySelector('.verdict-detail')!.textContent).toMatch(/tests réussis/);
    c.detruire();
  });

  it('erreur de compilation : message, pas de correction, on peut corriger', { timeout: 30_000 }, async () => {
    const { c, statuts } = await jouer('int main(void) { return x; }');
    expect(statuts).toEqual([]);
    expect(c.el.querySelector('.msg-invalide')!.textContent).toMatch(/compile/);
    expect(c.el.querySelector('.console-erreur')).toBeTruthy();
    expect(c.el.querySelector<HTMLButtonElement>('.actions .btn-primaire')!.disabled).toBe(false);
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
