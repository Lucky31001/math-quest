/** Tableau de bord : réussite par chapitre et par type de question, points faibles, activité. */
import { INDEX, chapitresDe, styleMatiere } from '../../core/loader';
import { TYPES_QUESTION, LIBELLES_TYPE } from '../../core/types-question';
import { h } from '../dom';
import { etat } from '../etat';
import { tauxChapitre, maitriseChapitre, pointsFaibles } from '../../game/modes';
import { ajouterJours } from '../../game/dates';
import { niveauDepuisXp } from '../../game/xp';
import { piegesRecurrents, tendanceExamens } from '../../game/progres';
import { courbeNotes } from '../components/courbe';
import { toutesLesMatieres } from '../../core/loader';
import { riche } from '../texte';
import { nombre } from '../../core/francais';
import { etatVide } from '../components/etat-vide';

/** Pièges récurrents : la même erreur (même distracteur ou même erreur typique) commise plusieurs fois. */
function sectionPieges(): HTMLElement | null {
  const pieges = piegesRecurrents(etat.p).slice(0, 8);
  if (!pieges.length) return null;
  return h(
    'section',
    { class: 'carte-info pieges' },
    h('h2', null, '🪤 Tes pièges récurrents'),
    h('p', { class: 'note' }, 'Ces erreurs reviennent : relis l’explication, puis entraîne-toi sur le chapitre.'),
    h(
      'ul',
      { class: 'liste-pieges' },
      pieges.map((x) => {
        const ch = INDEX.chapitres.find((c) => c.id === x.chapitre);
        return h(
          'li',
          null,
          h('span', { class: 'piege-compte', title: `${x.n} fois` }, `×${x.n}`),
          h(
            'div',
            { class: 'piege-corps' },
            h('div', { class: 'piege-reponse' }, 'Tu as répondu : ', riche('span', x.texte)),
            riche('p', x.explication, 'piege-explication'),
            ch ? h('a', { href: `#/jouer/entrainement/${ch.id}/tous` }, `${ch.icone} S’entraîner sur « ${ch.titre} »`) : null,
          ),
        );
      }),
    ),
  );
}

/** Examens blancs : une courbe par matière (dernière note, meilleure, tendance), et les notes en texte. */
function sectionExamens(): HTMLElement | null {
  const hist = etat.p.records.historiqueExamens;
  const matieres = toutesLesMatieres().filter((m) => hist[m.id]?.length);
  if (!matieres.length) return null;
  const note = (n: number) => `${String(n).replace('.', ',')}/20`;
  return h(
    'section',
    { class: 'carte-info examens' },
    h('h2', null, '📝 Examens blancs'),
    matieres.map((m) => {
      const notes = hist[m.id];
      const t = tendanceExamens(notes);
      const tendance = t === null ? null : t > 0 ? `▲ en progrès (+${String(t).replace('.', ',')})` : t < 0 ? `▼ en baisse (${String(t).replace('.', ',')})` : '► stable';
      return h(
        'div',
        { class: 'examen-matiere', style: styleMatiere(m) },
        h('h3', null, `${m.embleme} ${m.nom}`),
        h(
          'p',
          { class: 'examen-resume' },
          `Dernière : ${note(notes[notes.length - 1].note)} · Meilleure : ${note(etat.p.records.examens[m.id] ?? Math.max(...notes.map((x) => x.note)))} · ${nombre(notes.length, 'examen')}`,
          tendance ? h('span', { class: 'examen-tendance' }, ` · ${tendance}`) : null,
        ),
        courbeNotes(notes),
        h(
          'details',
          null,
          h('summary', null, 'Toutes les notes'),
          h('ol', { class: 'liste-notes' }, notes.map((x) => h('li', null, `${new Date(x.date).toLocaleDateString('fr-FR')} : ${note(x.note)}`))),
        ),
      );
    }),
  );
}

/** Seuil sous lequel un taux de réussite est signalé comme point faible. */
const SEUIL_FAIBLE = 0.6;

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

function barre(libelle: string | Node, taux: number | null, detail: string, lien?: string): HTMLElement {
  const faible = taux !== null && taux < SEUIL_FAIBLE;
  const contenu = [
    h('span', { class: 'stat-libelle' }, libelle),
    h('span', { class: 'stat-piste' }, h('span', { class: 'stat-remplie', style: `width:${taux === null ? 0 : Math.round(taux * 100)}%` })),
    h('span', { class: 'stat-valeur' }, pct(taux)),
    h('small', { class: 'stat-detail' }, detail),
  ];
  return lien
    ? h('a', { class: `stat-ligne ${faible ? 'faible' : ''} ${taux === null ? 'vide' : ''}`, href: lien }, contenu)
    : h('div', { class: `stat-ligne ${faible ? 'faible' : ''} ${taux === null ? 'vide' : ''}` }, contenu);
}

export function ecranStats(main: HTMLElement): void {
  const p = etat.p;
  const auj = etat.aujourdhui();

  // Totaux par type, tous chapitres confondus.
  const parType = TYPES_QUESTION.map((t) => {
    let tentatives = 0;
    let reussites = 0;
    for (const c of Object.values(p.stats)) {
      tentatives += c[t]?.tentatives ?? 0;
      reussites += c[t]?.reussites ?? 0;
    }
    return { t, tentatives, reussites, taux: tentatives ? reussites / tentatives : null };
  });

  const faibles = pointsFaibles(INDEX.chapitres, p).filter((f) => f.taux! < SEUIL_FAIBLE);
  const typesFaibles = parType.filter((x) => x.tentatives >= 3 && x.taux! < SEUIL_FAIBLE);

  // Activité des 28 derniers jours.
  const jours = Array.from({ length: 28 }, (_, i) => ajouterJours(auj, i - 27));
  const maxJ = Math.max(1, ...jours.map((j) => p.journal[j] ?? 0));
  const joursActifs = Object.keys(p.journal).length;

  // Aucune réponse encore : un message d'accueil plutôt qu'une page de zéros.
  if (p.compteurs.reponses === 0 && !piegesRecurrents(p).length && !Object.keys(p.records.historiqueExamens).length) {
    main.append(
      h('h1', null, '📊 Tableau de bord'),
      etatVide('📈', 'Tes statistiques apparaîtront ici', 'Réponds à tes premières questions : taux de réussite, activité, points faibles et pièges récurrents se rempliront au fil de tes séances.'),
    );
    return;
  }

  main.append(
    h('h1', null, '📊 Tableau de bord'),
    h(
      'div',
      { class: 'chiffres-cles' },
      h('div', null, h('strong', null, String(p.compteurs.reponses)), h('span', null, 'réponses')),
      h('div', null, h('strong', null, pct(p.compteurs.reponses ? p.compteurs.bonnes / p.compteurs.reponses : null)), h('span', null, 'de réussite')),
      h('div', null, h('strong', null, `Niv. ${niveauDepuisXp(p.xp).niveau}`), h('span', null, `${p.xp} XP`)),
      h('div', null, h('strong', null, `🔥 ${p.streak.record}`), h('span', null, 'meilleure série')),
      h('div', null, h('strong', null, String(joursActifs)), h('span', null, 'jours actifs')),
      h('div', null, h('strong', null, String(p.compteurs.indices)), h('span', null, 'indices utilisés')),
    ),
    faibles.length || typesFaibles.length
      ? h(
          'section',
          { class: 'carte-info points-faibles' },
          h('h2', null, '🎯 Points faibles'),
          h(
            'ul',
            null,
            faibles.map((f) => h('li', null, h('a', { href: `#/jouer/entrainement/${f.chapitre.id}/tous` }, `${f.chapitre.icone} ${f.chapitre.titre}`), ` : ${pct(f.taux)} — clique pour t'entraîner`)),
            typesFaibles.map((x) => h('li', null, `${LIBELLES_TYPE[x.t]} : ${pct(x.taux)} de réussite`)),
          ),
        )
      : h('p', { class: 'note' }, p.compteurs.reponses < 10 ? 'Réponds à quelques questions pour voir apparaître tes points faibles.' : '👏 Aucun point faible marqué (tous les taux ≥ 60 %).'),
    ...[sectionPieges(), sectionExamens()].filter((x): x is HTMLElement => x !== null),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Activité (28 derniers jours)'),
      h(
        'div',
        { class: 'activite', role: 'img', 'aria-label': 'Réponses par jour' },
        jours.map((j) => {
          const n = p.journal[j] ?? 0;
          return h('span', { class: 'jour', title: `${j} : ${nombre(n, 'réponse')}`, style: `--intensite:${n ? 0.25 + 0.75 * (n / maxJ) : 0}` });
        }),
      ),
    ),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Par type de question'),
      parType.map((x) => barre(LIBELLES_TYPE[x.t], x.taux, `${x.reussites}/${x.tentatives}`)),
    ),
    ...INDEX.catalogue.niveaux.flatMap((niveau) =>
      niveau.matieres.map((m) =>
      h(
        'section',
        { class: 'carte-info carte-matiere', style: styleMatiere(m) },
        h('h2', null, `${m.embleme} ${m.nom}`, INDEX.catalogue.niveaux.length > 1 ? h('small', { class: 'etiquette-niveau' }, niveau.nom) : null),
        chapitresDe(m.id).length === 0 ? h('p', { class: 'note' }, 'Pas encore de chapitre.') : null,
        chapitresDe(m.id)
          .map((c) => {
            const t = tauxChapitre(p, c.id);
            return barre(`${c.icone} ${c.titre}`, t.taux, `${t.reussites}/${t.tentatives} · maîtrise ${Math.round(maitriseChapitre(p, c) * 100)} %`, `#/chapitre/${c.id}/exercices`);
          }),
      ),
      ),
    ),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Détail chapitre × type'),
      h(
        'div',
        { class: 'tableau-defilant' },
        h(
          'table',
          { class: 'tableau-stats' },
          h('thead', null, h('tr', null, h('th', null, 'Chapitre'), TYPES_QUESTION.map((t) => h('th', null, LIBELLES_TYPE[t])))),
          h(
            'tbody',
            null,
            INDEX.chapitres.map((c) =>
              h(
                'tr',
                null,
                h('th', null, `${c.icone} ${c.titre}`),
                TYPES_QUESTION.map((t) => {
                  const s = p.stats[c.id]?.[t];
                  const taux = s?.tentatives ? s.reussites / s.tentatives : null;
                  return h('td', { class: taux !== null && taux < SEUIL_FAIBLE && s!.tentatives >= 2 ? 'faible' : '' }, s?.tentatives ? `${pct(taux)} (${s.tentatives})` : '·');
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
