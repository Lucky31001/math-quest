/** Écran d'un chapitre : onglets Cours / Flashcards / Exercices. */
import type { Chapitre, Difficulte } from '../../core/schema';
import { LIBELLES_TYPE } from '../../core/types-question';
import { chapitreParId, chargerChapitre, cle, matiereParId, styleMatiere } from '../../core/loader';
import { ecranApresChargement } from '../chargement';
import { selectionnerMatiere } from '../selection';
import { generateursDu } from '../../generators';
import { h } from '../dom';
import { riche } from '../texte';
import { etat } from '../etat';
import { paquetFlashcards } from '../components/flashcards';
import { afficherQuestion } from '../components/question';
import { enregistrerReponse, payerIndice } from '../../game/progres';
import { maitriseChapitre, tauxChapitre } from '../../game/modes';
import { jouerSon, secouer } from '../effets';
import { icone } from '../icones';
import { ouvrirDansAtelier } from './atelier';

const LIBELLES_BLOC: Record<string, string> = {
  definition: 'Définition',
  theoreme: 'Théorème',
  propriete: 'Propriété',
  methode: 'Méthode',
  remarque: 'Remarque',
  exemple: 'Exemple',
};

type Onglet = 'cours' | 'flashcards' | 'exercices';

export function ecranChapitre(main: HTMLElement, params: string[]): () => void {
  const resume = chapitreParId(params[0] ?? '');
  if (!resume) {
    main.append(h('div', { class: 'carte-vide' }, h('p', null, 'Chapitre introuvable.'), h('a', { class: 'btn', href: '#/' }, 'Accueil')));
    return () => {};
  }
  return ecranApresChargement(main, () => chargerChapitre(resume.id), (ch) => rendreChapitre(main, ch, params));
}

function rendreChapitre(main: HTMLElement, ch: Chapitre, params: string[]): () => void {
  const onglet: Onglet = (['cours', 'flashcards', 'exercices'] as const).find((o) => o === params[1]) ?? 'cours';
  let nettoyer = () => {};

  const matiere = matiereParId(ch.monde);
  // Au retour sur la carte, on retrouve la matière de ce chapitre.
  selectionnerMatiere(ch.monde);
  const p = etat.p;
  const maitrise = Math.round(maitriseChapitre(p, ch) * 100);
  const t = tauxChapitre(p, ch.id);
  const boss = p.records.boss[ch.id];

  main.append(
    h(
      'header',
      { class: 'chapitre-entete', style: styleMatiere(matiere) },
      h('a', { href: '#/', class: 'lien-retour' }, icone('retour'), h('span', null, matiere ? `${matiere.embleme} ${matiere.nom}` : 'Accueil')),
      h('h1', null, h('span', { class: 'icone' }, ch.icone), ` ${ch.titre}`),
      riche('p', ch.resume, 'resume'),
      h(
        'div',
        { class: 'chapitre-stats' },
        h('span', null, `🎯 Maîtrise ${maitrise} %`),
        h('span', null, t.taux === null ? '📈 Pas encore de tentative' : `📈 Réussite ${Math.round(t.taux * 100)} % (${t.tentatives})`),
        h('span', null, boss?.vaincu ? '🏆 Boss vaincu' : '👹 Boss invaincu'),
      ),
    ),
    h(
      'nav',
      { class: 'onglets', role: 'tablist' },
      (['cours', 'flashcards', 'exercices'] as const).map((o) =>
        h(
          'a',
          { href: `#/chapitre/${ch.id}/${o}`, role: 'tab', 'aria-selected': String(o === onglet), class: o === onglet ? 'actif' : '' },
          { cours: '📖 Cours', flashcards: '🎴 Flashcards', exercices: '✏️ Exercices' }[o],
        ),
      ),
    ),
  );

  const contenu = h('section', { class: 'onglet-contenu' });
  main.append(contenu);

  if (onglet === 'cours') contenu.append(cours(ch));
  else if (onglet === 'flashcards') {
    if (!ch.flashcards.length) contenu.append(h('p', null, 'Pas encore de flashcards dans ce chapitre.'));
    else {
      const paquet = paquetFlashcards(ch.flashcards.map((flashcard) => ({ chapitre: ch, flashcard })));
      contenu.append(paquet.el);
      nettoyer = paquet.detruire;
    }
  } else nettoyer = exercices(ch, contenu);

  return () => nettoyer();
}

/** Légende des couleurs des blocs de cours (seulement les types présents dans le chapitre). */
function legende(ch: Chapitre): HTMLElement {
  const presents = new Set(ch.cours.flatMap((s) => s.blocs.map((b) => b.type)));
  return h(
    'div',
    { class: 'legende-cours', role: 'note', 'aria-label': 'Légende des couleurs' },
    h('span', { class: 'legende-titre' }, 'Légende'),
    Object.keys(LIBELLES_BLOC)
      .filter((t) => presents.has(t as never))
      .map((t) => h('span', { class: `pastille-bloc bloc-${t}` }, h('span', { class: 'puce', 'aria-hidden': 'true' }), LIBELLES_BLOC[t])),
  );
}

function cours(ch: Chapitre): HTMLElement {
  const el = h(
    'div',
    { class: 'cours' },
    legende(ch),
    ch.cours.map((s) =>
      h(
        'section',
        { class: 'cours-section' },
        h('h2', null, s.titre),
        s.blocs.map((b) =>
          h(
            'div',
            { class: `bloc bloc-${b.type}` },
            h('div', { class: 'bloc-titre' }, LIBELLES_BLOC[b.type], b.titre ? ` — ${b.titre}` : ''),
            riche('div', b.texte, 'bloc-texte'),
          ),
        ),
      ),
    ),
    h('div', { class: 'actions' }, h('a', { class: 'btn btn-primaire', href: `#/chapitre/${ch.id}/exercices` }, "Passer aux exercices →")),
  );
  // Code C du cours : bouton pour l'essayer dans l'atelier.
  const blocsC = [...el.querySelectorAll<HTMLElement>('pre.code[data-langage="c"]')];
  blocsC.forEach((pre, i) => {
    const code = pre.textContent ?? '';
    // Les blocs précédents fournissent les types utilisés (ex. `Maillon`).
    const precedents = blocsC.slice(0, i).map((p) => p.textContent ?? '');
    pre.after(h('button', { class: 'btn btn-essayer', type: 'button', onclick: () => ouvrirDansAtelier(code, precedents) }, '▶ Essayer dans l’atelier'));
  });
  if (blocsC.length) el.querySelector('.actions')!.prepend(h('a', { class: 'btn', href: '#/atelier' }, '🧪 Atelier C'));
  return el;
}

function exercices(ch: Chapitre, conteneur: HTMLElement): () => void {
  let diff: Difficulte | null = null;
  let nettoyerQuestion = () => {};
  const aGenerateurs = generateursDu(ch.id).length > 0;

  const choixDiff = h(
    'div',
    { class: 'choix-difficulte', role: 'radiogroup', 'aria-label': 'Difficulté' },
    ([null, 1, 2, 3] as const).map((d) =>
      h(
        'button',
        {
          type: 'button',
          class: `btn btn-petit ${d === diff ? 'actif' : ''}`,
          'aria-pressed': String(d === diff),
          onclick: (e: Event) => {
            diff = d;
            choixDiff.querySelectorAll('button').forEach((b) => {
              b.classList.toggle('actif', b === e.currentTarget);
              b.setAttribute('aria-pressed', String(b === e.currentTarget));
            });
            majLiens();
          },
        },
        d === null ? 'Toutes' : '★'.repeat(d),
      ),
    ),
  );
  const lienEntrainement = h('a', { class: 'btn btn-primaire carte-mode' }, h('strong', null, "🎯 S'entraîner"), h('span', null, '10 questions, fixes + générées'));
  const lienInfini = aGenerateurs ? h('a', { class: 'btn carte-mode' }, h('strong', null, '🎲 Exercices infinis'), h('span', null, generateursDu(ch.id).map((g) => g.titre).join(' · '))) : null;
  const lienBoss = h('a', { class: 'btn btn-boss carte-mode', href: `#/jouer/boss/${ch.id}` }, h('strong', null, '👹 Affronter le boss'), h('span', null, '10 questions chronométrées, 3 vies'));
  const majLiens = () => {
    lienEntrainement.href = `#/jouer/entrainement/${ch.id}/${diff ?? 'tous'}`;
    if (lienInfini) lienInfini.href = `#/jouer/infini/${ch.id}/${diff ?? 'tous'}`;
  };
  majLiens();

  const zoneQuestion = h('div', { class: 'zone-question-isolee' });
  const liste = h(
    'ol',
    { class: 'liste-exercices' },
    ch.exercices.map((q) => {
      const e = etat.p.questions[cle(ch.id, q.id)];
      const statut = !e ? '○' : e.boite >= 4 ? '★' : e.reussites > 0 ? '◐' : '✗';
      const titre = q.enonce.replace(/\$[^$]*\$/g, '…').replace(/\*\*/g, '').slice(0, 90);
      return h(
        'li',
        null,
        h(
          'button',
          {
            type: 'button',
            class: 'exercice-ligne',
            onclick: () => ouvrir(q.id),
            title: e ? `Boîte ${e.boite} · ${e.reussites}/${e.vues} réussites` : 'Jamais tentée',
          },
          h('span', { class: `statut statut-${statut === '★' ? 'maitrise' : statut === '◐' ? 'encours' : statut === '✗' ? 'rate' : 'nouveau'}` }, statut),
          h('span', { class: 'ex-type' }, LIBELLES_TYPE[q.type]),
          h('span', { class: 'ex-diff' }, '★'.repeat(q.difficulte)),
          h('span', { class: 'ex-titre' }, titre),
        ),
      );
    }),
  );

  function ouvrir(id: string) {
    const q = ch.exercices.find((x) => x.id === id)!;
    nettoyerQuestion();
    const c = afficherQuestion({
      question: q,
      surIndice: () => (etat.modifier(payerIndice), true),
      surResultat: (r) => {
        const correct = r.statut === 'correct';
        etat.modifier((p) => enregistrerReponse(p, { chapitre: ch.id, cle: cle(ch.id, q.id), type: q.type, difficulte: q.difficulte, correct, credit: r.credit }, etat.aujourdhui()));
        jouerSon(correct ? 'juste' : 'faux');
        if (!correct) secouer(c.el.querySelector('.zone-reponse') ?? c.el);
      },
      surSuivant: () => {
        nettoyerQuestion();
        zoneQuestion.replaceChildren();
        liste.scrollIntoView({ behavior: 'smooth' });
      },
      libelleSuivant: 'Fermer',
    });
    nettoyerQuestion = c.detruire;
    zoneQuestion.replaceChildren(c.el);
    zoneQuestion.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  conteneur.append(
    h('div', { class: 'barre-difficulte' }, h('span', null, 'Difficulté :'), choixDiff),
    h('div', { class: 'grille-modes' }, lienEntrainement, lienInfini, lienBoss),
    zoneQuestion,
    h('h2', null, `Toutes les questions (${ch.exercices.length})`),
    h('p', { class: 'legende' }, '○ jamais tentée · ✗ ratée · ◐ réussie · ★ maîtrisée (boîte ≥ 4)'),
    liste,
  );
  return () => nettoyerQuestion();
}
