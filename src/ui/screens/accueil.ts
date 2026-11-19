/**
 * Accueil : révision du jour et modes de jeu, puis le parcours.
 *
 * Le parcours est piloté par content/catalogue.json : niveaux (années) → matières.
 *   - sélecteur de niveau (affiché seulement s'il y a plusieurs niveaux) ;
 *   - onglets de matières du niveau, avec progression ;
 *   - chemin des chapitres de la matière choisie.
 * Ajouter une matière ou un niveau ne demande donc aucun code.
 */
import { CONTENU, chapitresDe, matiereParId, niveauDeMatiere, styleMatiere } from '../../core/loader';
import type { Chapitre, Matiere } from '../../core/schema';
import { h, ajouter } from '../dom';
import { etat } from '../etat';
import { maitriseChapitre, questionsDues, flashcardsDues } from '../../game/modes';
import { matiereSelectionnee, selectionnerMatiere } from '../selection';

export function ecranAccueil(main: HTMLElement): void {
  const p = etat.p;
  const auj = etat.aujourdhui();
  const nbQ = questionsDues(CONTENU.chapitres, p, auj, 999).length;
  const nbF = flashcardsDues(CONTENU.chapitres, p, auj).length;

  if (CONTENU.erreurs.length)
    main.append(
      h(
        'div',
        { class: 'alerte', role: 'alert' },
        h('strong', null, `⚠️ ${CONTENU.erreurs.length} fichier(s) de contenu invalide(s) ont été ignorés :`),
        h('ul', null, CONTENU.erreurs.map((e) => h('li', null, h('code', null, e.fichier), h('ul', null, e.messages.slice(0, 5).map((m) => h('li', null, m)))))),
      ),
    );

  main.append(
    h(
      'section',
      { class: 'tableau-accueil' },
      h(
        'a',
        { class: `carte-action revision ${nbQ + nbF ? 'a-faire' : ''}`, href: '#/revision' },
        h('span', { class: 'carte-icone' }, '📅'),
        h('strong', null, 'Révision du jour'),
        h('span', null, nbQ + nbF ? `${nbQ} question(s) et ${nbF} flashcard(s) à revoir` : 'Tout est à jour ✨'),
      ),
      h(
        'a',
        { class: 'carte-action survie', href: '#/jouer/survie' },
        h('span', { class: 'carte-icone' }, '🛡️'),
        h('strong', null, 'Survie'),
        h('span', null, `Tous chapitres, jusqu'à la 1re erreur · record ${p.records.survie}`),
      ),
      h(
        'a',
        { class: 'carte-action eclair', href: '#/jouer/eclair' },
        h('span', { class: 'carte-icone' }, '⚡'),
        h('strong', null, 'QCM éclair'),
        h('span', null, `20 QCM en 3 min, combos · record ${p.records.eclair} pts`),
      ),
    ),
  );

  const parcours = h('section', { class: 'parcours', 'aria-label': 'Parcours' });
  main.append(parcours);
  rendreParcours(parcours);
}

/** Maîtrise moyenne d'une matière (0..1). */
function maitriseMatiere(m: Matiere): number {
  const chs = chapitresDe(m.id);
  return chs.length ? chs.reduce((s, c) => s + maitriseChapitre(etat.p, c), 0) / chs.length : 0;
}

function rendreParcours(conteneur: HTMLElement): void {
  const niveaux = CONTENU.catalogue.niveaux;
  const idMatiere = matiereSelectionnee();
  const matiere = idMatiere ? matiereParId(idMatiere) : undefined;
  if (!matiere) {
    conteneur.replaceChildren(h('p', { class: 'note' }, 'Aucune matière dans content/catalogue.json.'));
    return;
  }
  const niveau = niveauDeMatiere(matiere.id)!;
  const choisir = (id: string) => {
    selectionnerMatiere(id);
    rendreParcours(conteneur);
  };

  // Sélecteur de niveau (années), seulement s'il y en a plusieurs.
  const selecteurNiveau =
    niveaux.length > 1
      ? h(
          'div',
          { class: 'niveaux', role: 'tablist', 'aria-label': 'Niveau' },
          niveaux.map((n) =>
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                class: `niveau-onglet ${n.id === niveau.id ? 'actif' : ''}`,
                'aria-selected': String(n.id === niveau.id),
                onclick: () => choisir(n.matieres[0].id),
              },
              n.nom,
            ),
          ),
        )
      : null;

  // Onglets de matières du niveau.
  const onglets = h(
    'div',
    { class: 'matieres', role: 'tablist', 'aria-label': 'Matières' },
    niveau.matieres.map((m) => {
      const chs = chapitresDe(m.id);
      const vaincus = chs.filter((c) => etat.p.records.boss[c.id]?.vaincu).length;
      const pct = Math.round(maitriseMatiere(m) * 100);
      return h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `matiere-onglet ${m.id === matiere.id ? 'actif' : ''}`,
          style: styleMatiere(m),
          'aria-selected': String(m.id === matiere.id),
          onclick: () => choisir(m.id),
        },
        h('span', { class: 'matiere-embleme', 'aria-hidden': 'true' }, m.embleme),
        h('span', { class: 'matiere-texte' }, h('strong', null, m.nom), h('small', null, chs.length ? `${pct} % · 👑 ${vaincus}/${chs.length}` : 'Bientôt')),
        h('span', { class: 'matiere-jauge', style: `--pct:${pct}` }),
      );
    }),
  );

  const chapitres = chapitresDe(matiere.id);
  const recommande = chapitres.find((c) => maitriseChapitre(etat.p, c) < 0.5);
  const vaincus = chapitres.filter((c) => etat.p.records.boss[c.id]?.vaincu).length;

  const monde = h(
    'div',
    { class: 'monde', style: styleMatiere(matiere) },
    h(
      'header',
      { class: 'monde-entete' },
      h(
        'div',
        null,
        h('p', { class: 'monde-section' }, `${niveau.nom} · 👑 ${vaincus}/${chapitres.length} boss`),
        h('h2', null, `${matiere.embleme} ${matiere.nom}`),
        h('p', null, matiere.sousTitre),
      ),
      h('span', { class: 'monde-pct', title: 'Maîtrise de la matière' }, `${Math.round(maitriseMatiere(matiere) * 100)} %`),
    ),
    chapitres.length
      ? h('ol', { class: 'chemin' }, chapitres.map((c, i) => zone(c, i, c === recommande)))
      : h('div', { class: 'carte-vide' }, h('p', null, '🚧 Les chapitres de cette matière arrivent bientôt.')),
  );

  conteneur.replaceChildren();
  ajouter(conteneur, [selecteurNiveau, onglets, monde]);
}

/** Décalage horizontal des nœuds : le chemin serpente comme une rivière. */
const DECALAGES = [0, 44, 66, 44, 0, -44, -66, -44];

function zone(c: Chapitre, i: number, recommande: boolean): HTMLElement {
  const p = etat.p;
  const m = Math.round(maitriseChapitre(p, c) * 100);
  const boss = p.records.boss[c.id];
  const etatZone = boss?.vaincu ? 'conquise' : m >= 50 ? 'avancee' : recommande ? 'recommandee' : 'a-venir';
  return h(
    'li',
    { class: `zone ${etatZone}`, style: `--decalage:${DECALAGES[i % DECALAGES.length]}px` },
    h(
      'a',
      { href: `#/chapitre/${c.id}`, class: 'zone-lien', 'aria-label': `${c.titre}, maîtrise ${m} %` },
      recommande ? h('span', { class: 'bulle' }, 'Commencer') : null,
      h(
        'span',
        { class: 'zone-anneau', style: `--maitrise:${m}` },
        h('span', { class: 'zone-noeud' }, h('span', { class: 'zone-icone' }, c.icone)),
        boss?.vaincu ? h('span', { class: 'couronne', title: 'Boss vaincu' }, '👑') : null,
      ),
      h('span', { class: 'zone-texte' }, h('strong', null, c.titre), h('span', null, `${m} % maîtrisé`)),
    ),
  );
}
