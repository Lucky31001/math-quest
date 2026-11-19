/** Tableau de bord : réussite par chapitre et par type de question, points faibles, activité. */
import { CONTENU, chapitresDe, styleMatiere } from '../../core/loader';
import { TYPES_QUESTION, LIBELLES_TYPE } from '../../core/schema';
import { h } from '../dom';
import { etat } from '../etat';
import { tauxChapitre, maitriseChapitre, pointsFaibles } from '../../game/modes';
import { ajouterJours } from '../../game/dates';
import { niveauDepuisXp } from '../../game/xp';

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

  const faibles = pointsFaibles(CONTENU.chapitres, p).filter((f) => f.taux! < SEUIL_FAIBLE);
  const typesFaibles = parType.filter((x) => x.tentatives >= 3 && x.taux! < SEUIL_FAIBLE);

  // Activité des 28 derniers jours.
  const jours = Array.from({ length: 28 }, (_, i) => ajouterJours(auj, i - 27));
  const maxJ = Math.max(1, ...jours.map((j) => p.journal[j] ?? 0));
  const joursActifs = Object.keys(p.journal).length;

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
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Activité (28 derniers jours)'),
      h(
        'div',
        { class: 'activite', role: 'img', 'aria-label': 'Réponses par jour' },
        jours.map((j) => {
          const n = p.journal[j] ?? 0;
          return h('span', { class: 'jour', title: `${j} : ${n} réponse(s)`, style: `--intensite:${n ? 0.25 + 0.75 * (n / maxJ) : 0}` });
        }),
      ),
    ),
    h(
      'section',
      { class: 'carte-info' },
      h('h2', null, 'Par type de question'),
      parType.map((x) => barre(LIBELLES_TYPE[x.t], x.taux, `${x.reussites}/${x.tentatives}`)),
    ),
    ...CONTENU.catalogue.niveaux.flatMap((niveau) =>
      niveau.matieres.map((m) =>
      h(
        'section',
        { class: 'carte-info carte-matiere', style: styleMatiere(m) },
        h('h2', null, `${m.embleme} ${m.nom}`, CONTENU.catalogue.niveaux.length > 1 ? h('small', { class: 'etiquette-niveau' }, niveau.nom) : null),
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
            CONTENU.chapitres.map((c) =>
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
