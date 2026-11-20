/** Révision du jour : questions et flashcards dues (répétition espacée de Leitner). */
import { INDEX, chargerChapitres } from '../../core/loader';
import { ecranApresChargement } from '../chargement';
import { h, ajouter } from '../dom';
import { etat } from '../etat';
import { questionsDues, flashcardsDues, pointsFaibles } from '../../game/modes';
import { paquetFlashcards } from '../components/flashcards';
import { INTERVALLES } from '../../game/leitner';
import { icone } from '../icones';

export function ecranRevision(main: HTMLElement, params: string[]): () => void {
  const p = etat.p;
  const auj = etat.aujourdhui();
  const qs = questionsDues(INDEX.chapitres, p, auj, 999);
  const fs = flashcardsDues(INDEX.chapitres, p, auj);
  const faibles = pointsFaibles(INDEX.chapitres, p).slice(0, 3);

  if (params[0] === 'flashcards' && fs.length) {
    // Les textes des flashcards sont dans les chapitres complets : on charge ceux qui en ont de dues.
    const ids = [...new Set(fs.map((f) => f.chapitre.id))];
    return ecranApresChargement(main, () => chargerChapitres(ids), (chapitres) => {
      const paquet = paquetFlashcards(flashcardsDues(chapitres, etat.p, auj));
      main.append(h('h1', null, '🎴 Flashcards du jour'), paquet.el, h('a', { class: 'lien-retour', href: '#/revision' }, icone('retour'), h('span', null, 'Révision du jour')));
      return paquet.detruire;
    });
  }

  // Répartition des éléments par boîte de Leitner.
  const boites = [1, 2, 3, 4, 5].map((b) => ({
    b,
    n: Object.values(p.questions).filter((e) => e.boite === b).length + Object.values(p.flashcards).filter((e) => e.boite === b).length,
  }));
  const max = Math.max(1, ...boites.map((x) => x.n));

  ajouter(main, [
    h('h1', null, '📅 Révision du jour'),
    h('p', { class: 'intro' }, 'Répétition espacée : chaque bonne réponse envoie la question dans la boîte suivante (revue de plus en plus espacée) ; une erreur la renvoie en boîte 1, à revoir dès aujourd\'hui.'),
    h(
      'div',
      { class: 'grille-modes' },
      h(
        'a',
        { class: `btn carte-mode ${qs.length ? 'btn-primaire' : ''}`, href: '#/jouer/revision' },
        h('strong', null, `✏️ ${qs.length} question(s) à revoir`),
        h('span', null, qs.length ? 'Les plus fragiles en premier' : faibles.length ? `Rien de dû : entraînement sur « ${faibles[0].chapitre.titre} »` : 'Rien de dû pour l\'instant'),
      ),
      fs.length
        ? h('a', { class: 'btn carte-mode btn-primaire', href: '#/revision/flashcards' }, h('strong', null, `🎴 ${fs.length} flashcard(s) à revoir`), h('span', null, 'Auto-évaluation'))
        : h('div', { class: 'btn carte-mode desactive' }, h('strong', null, '🎴 Aucune flashcard due'), h('span', null, 'Révise les flashcards d\'un chapitre pour les ajouter')),
    ),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Tes boîtes de Leitner'),
      h(
        'div',
        { class: 'boites' },
        boites.map(({ b, n }) =>
          h(
            'div',
            { class: 'boite' },
            h('div', { class: 'boite-barre', style: `height:${Math.round((n / max) * 100)}%` }),
            h('strong', null, String(n)),
            h('span', null, `Boîte ${b}`),
            h('small', null, `revue à ${INTERVALLES[b]} j`),
          ),
        ),
      ),
    ),
    faibles.length
      ? h(
          'section',
          { class: 'carte-info' },
          h('h2', null, '🎯 Tes points faibles'),
          h(
            'ul',
            { class: 'liste-faibles' },
            faibles.map((f) =>
              h('li', null, h('a', { href: `#/jouer/entrainement/${f.chapitre.id}/tous` }, `${f.chapitre.icone} ${f.chapitre.titre}`), ` — ${Math.round(f.taux! * 100)} % de réussite`),
            ),
          ),
        )
      : null,
  ]);
  return () => {};
}
