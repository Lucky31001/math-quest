/**
 * Accueil : révision du jour et modes de jeu, puis le parcours.
 *
 * Le parcours est piloté par content/catalogue.json : niveaux (années) → matières.
 *   - sélecteur de niveau (affiché seulement s'il y a plusieurs niveaux) ;
 *   - carrousel à points des matières du niveau (une carte par matière) ;
 *   - chemin des chapitres de la matière choisie.
 * Ajouter une matière ou un niveau ne demande donc aucun code.
 */
import { INDEX, chapitresDe, matiereParId, niveauDeMatiere, styleMatiere } from '../../core/loader';
import type { ChapitreResume, Matiere, Niveau } from '../../core/schema';
import { h, ajouter } from '../dom';
import { etat } from '../etat';
import { maitriseChapitre, questionsDues, flashcardsDues, EXAMEN } from '../../game/modes';
import { matiereSelectionnee, selectionnerMatiere } from '../selection';

export function ecranAccueil(main: HTMLElement): void {
  const p = etat.p;
  const auj = etat.aujourdhui();
  const nbQ = questionsDues(INDEX.chapitres, p, auj, 999).length;
  const nbF = flashcardsDues(INDEX.chapitres, p, auj).length;

  // .accueil : sur grand écran, modes et matières à gauche, chemin des chapitres à droite.
  const accueil = h('div', { class: 'accueil' });
  main.append(accueil);
  accueil.append(
    h(
      'section',
      { class: 'tableau-accueil' },
      h(
        'a',
        { class: `carte-action revision ${nbQ + nbF ? 'a-faire' : ''}`, href: '#/revision' },
        h('span', { class: 'carte-icone' }, '📅', nbQ + nbF ? h('span', { class: 'compte', 'aria-hidden': 'true' }, String(nbQ + nbF)) : null),
        h('strong', null, 'Révision du jour'),
        h('span', null, nbQ + nbF ? `${nbQ} question(s) et ${nbF} flashcard(s) à revoir` : 'Tout est à jour ✨'),
      ),
      h(
        'a',
        { class: 'carte-action survie', href: '#/jouer/survie' },
        h('span', { class: 'carte-icone' }, '🛡️'),
        h('strong', null, 'Survie'),
        h('span', null, `Tous chapitres, jusqu'à la 1re erreur${p.records.survie ? ` · record ${p.records.survie}` : ''}`),
      ),
      h(
        'a',
        { class: 'carte-action eclair', href: '#/jouer/eclair' },
        h('span', { class: 'carte-icone' }, '⚡'),
        h('strong', null, 'QCM éclair'),
        h('span', null, `20 QCM en 3 min, combos${p.records.eclair ? ` · record ${p.records.eclair} pts` : ''}`),
      ),
    ),
  );

  const parcours = h('section', { class: 'parcours', 'aria-label': 'Parcours' });
  accueil.append(parcours);
  rendreParcours(parcours);
}

/** Maîtrise moyenne d'une matière (0..1). */
function maitriseMatiere(m: Matiere): number {
  const chs = chapitresDe(m.id);
  return chs.length ? chs.reduce((s, c) => s + maitriseChapitre(etat.p, c), 0) / chs.length : 0;
}

function rendreParcours(conteneur: HTMLElement): void {
  const niveaux = INDEX.catalogue.niveaux;
  const idMatiere = matiereSelectionnee();
  const matiere = idMatiere ? matiereParId(idMatiere) : undefined;
  if (!matiere) {
    conteneur.replaceChildren(h('p', { class: 'note' }, 'Aucune matière dans content/catalogue.json.'));
    return;
  }
  const niveau = niveauDeMatiere(matiere.id)!;

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
                onclick: () => {
                  selectionnerMatiere(n.matieres[0].id);
                  rendreParcours(conteneur);
                },
              },
              n.nom,
            ),
          ),
        )
      : null;

  const zoneChemin = h('div', { class: 'zone-chemin' });
  const carrousel = creerCarrousel(niveau, matiere.id, (id) => {
    selectionnerMatiere(id);
    rendreChemin(zoneChemin, id);
  });
  conteneur.replaceChildren();
  ajouter(conteneur, [selecteurNiveau, carrousel.el, zoneChemin]);
  rendreChemin(zoneChemin, matiere.id);
  carrousel.placer();
}

/**
 * Carrousel à points des matières d'un niveau : une carte par matière, défilement au
 * doigt (scroll-snap), flèches pour la souris, flèches du clavier, points cliquables.
 * La carte affichée devient la matière sélectionnée.
 */
function creerCarrousel(niveau: Niveau, initiale: string, surChoix: (id: string) => void): { el: HTMLElement; placer: () => void } {
  const matieres = niveau.matieres;
  let actif = Math.max(0, matieres.findIndex((m) => m.id === initiale));

  const diapos = matieres.map((m, i) => {
    const chs = chapitresDe(m.id);
    const vaincus = chs.filter((c) => etat.p.records.boss[c.id]?.vaincu).length;
    const pct = Math.round(maitriseMatiere(m) * 100);
    return h(
      'article',
      {
        class: 'diapo',
        style: styleMatiere(m),
        role: 'group',
        'aria-roledescription': 'diapositive',
        'aria-label': `${i + 1} sur ${matieres.length} : ${m.nom}`,
      },
      h('p', { class: 'monde-section' }, `${niveau.nom} · ${chs.length ? `👑 ${vaincus}/${chs.length} boss` : 'bientôt'}`),
      h(
        'div',
        { class: 'diapo-titre' },
        h('span', { class: 'diapo-embleme', 'aria-hidden': 'true' }, m.embleme),
        h('div', null, h('h2', null, m.nom), h('p', null, m.sousTitre)),
      ),
      h(
        'div',
        { class: 'diapo-progression' },
        h('span', { class: 'diapo-jauge' }, h('span', { style: `width:${pct}%` })),
        h('strong', null, `${pct} %`),
      ),
    );
  });

  const piste = h('div', { class: 'piste', tabindex: '0', 'aria-label': 'Matières (flèches gauche / droite pour changer)' }, diapos);
  // Onglets nommés (au-dessus des diapos) : on voit d'emblée toutes les matières.
  const points = h(
    'div',
    { class: 'points', role: 'tablist', 'aria-label': 'Choisir une matière', hidden: matieres.length < 2 },
    matieres.map((m, i) =>
      h(
        'button',
        { type: 'button', role: 'tab', class: 'point', style: styleMatiere(m), onclick: () => aller(i) },
        h('span', { 'aria-hidden': 'true' }, m.embleme),
        m.nom,
      ),
    ),
  );
  const fleche = (sens: -1 | 1) =>
    h(
      'button',
      { type: 'button', class: `fleche ${sens < 0 ? 'prec' : 'suiv'}`, 'aria-label': sens < 0 ? 'Matière précédente' : 'Matière suivante', onclick: () => aller(actif + sens) },
      sens < 0 ? '‹' : '›',
    );
  const precedente = fleche(-1);
  const suivante = fleche(1);

  /** Met à jour points, flèches et sélection pour la diapo i. */
  function activer(i: number) {
    const change = i !== actif;
    actif = i;
    points.querySelectorAll('.point').forEach((p, k) => {
      p.classList.toggle('actif', k === i);
      p.setAttribute('aria-selected', String(k === i));
    });
    // Onglet actif visible dans la rangée (qui défile sur un téléphone).
    const onglet = points.children[i] as HTMLElement | undefined;
    points.scrollTo?.({ left: (onglet?.offsetLeft ?? 0) - points.offsetLeft - 16, behavior: 'smooth' });
    diapos.forEach((d, k) => d.classList.toggle('actif', k === i));
    precedente.disabled = i === 0;
    suivante.disabled = i === matieres.length - 1;
    if (change) surChoix(matieres[i].id);
  }

  function aller(i: number, doux = true) {
    const k = Math.min(matieres.length - 1, Math.max(0, i));
    piste.scrollTo?.({ left: diapos[k].offsetLeft - piste.offsetLeft, behavior: doux ? 'smooth' : 'auto' });
    activer(k);
  }

  // Défilement au doigt : la diapo la plus proche devient active quand le défilement s'arrête.
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  piste.addEventListener('scroll', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      const x = piste.scrollLeft;
      let meilleur = 0;
      diapos.forEach((d, k) => {
        if (Math.abs(d.offsetLeft - piste.offsetLeft - x) < Math.abs(diapos[meilleur].offsetLeft - piste.offsetLeft - x)) meilleur = k;
      });
      if (meilleur !== actif) activer(meilleur);
    }, 120);
  });
  piste.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      aller(actif + (e.key === 'ArrowLeft' ? -1 : 1));
    }
  });

  activer(actif);
  const el = h(
    'div',
    { class: 'matieres' },
    points,
    h('div', { class: 'carrousel', 'aria-roledescription': 'carrousel', 'aria-label': `Matières — ${niveau.nom}` }, matieres.length > 1 ? precedente : null, piste, matieres.length > 1 ? suivante : null),
  );
  // Position initiale sans animation, une fois l'élément dans la page.
  return { el, placer: () => requestAnimationFrame(() => aller(actif, false)) };
}

/** Chemin de chapitres d'une matière. */
function rendreChemin(conteneur: HTMLElement, idMatiere: string): void {
  const chapitres = chapitresDe(idMatiere);
  const recommande = chapitres.find((c) => maitriseChapitre(etat.p, c) < 0.5);
  conteneur.replaceChildren(
    h(
      'div',
      { class: 'monde', style: styleMatiere(matiereParId(idMatiere)) },
      chapitres.length
        ? h(
            'ol',
            { class: 'chemin' },
            chapitres.flatMap((c, i) => {
              const noeud = zone(c, i, c === recommande);
              const avant = chapitres[i - 1];
              // Changement de semestre : un jalon avant le premier chapitre du nouveau semestre.
              return c.semestre && avant?.semestre && c.semestre !== avant.semestre ? [jalonSemestre(c.semestre), noeud] : [noeud];
            }),
          )
        : h('div', { class: 'carte-vide' }, h('p', null, '🚧 Les chapitres de cette matière arrivent bientôt.')),
      chapitres.length ? lienExamen(idMatiere) : null,
    ),
  );
}

/** Jalon entre deux semestres sur le chemin. */
function jalonSemestre(semestre: number): HTMLElement {
  return h('li', { class: 'jalon-semestre' }, h('span', null, `Semestre ${semestre}`));
}

/** Au bout du chemin : l'examen blanc de la matière (tous ses chapitres, en temps limité). */
function lienExamen(idMatiere: string): HTMLElement {
  const meilleure = etat.p.records.examens[idMatiere];
  return h(
    'a',
    { class: 'carte-action examen', href: `#/jouer/examen/${idMatiere}` },
    h('span', { class: 'carte-icone' }, '📝'),
    h('strong', null, 'Examen blanc'),
    h(
      'span',
      null,
      `${EXAMEN.questions} questions, ${EXAMEN.duree / 60} min, corrigé à la fin`,
      meilleure !== undefined ? ` · meilleure note ${String(meilleure).replace('.', ',')}/20` : '',
    ),
  );
}

/** Décalage horizontal des nœuds : le chemin serpente comme une rivière. */
const DECALAGES = [0, 44, 66, 44, 0, -44, -66, -44];

function zone(c: ChapitreResume, i: number, recommande: boolean): HTMLElement {
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
