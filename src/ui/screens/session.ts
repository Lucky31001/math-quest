/**
 * Écran de jeu commun à tous les modes : entraînement, exercices infinis, Boss,
 * Survie, QCM éclair et Révision du jour.
 */
import type { Chapitre, Difficulte } from '../../core/schema';
import { INDEX, chapitreParId, chapitresDe, chargerChapitre, chargerChapitres, chargerTout, matiereParId } from '../../core/loader';
import { ecranApresChargement } from '../chargement';
import { createRng, randomSeed } from '../../core/random';
import { h, vider, ajouter } from '../dom';
import { etat } from '../etat';
import { afficherQuestion, type ControleurQuestion } from '../components/question';
import { enregistrerReponse, enregistrerExamen, payerIndice, validerSerie, TAILLE_SERIE_INFINIE, type InfoReponse } from '../../game/progres';
import { icone } from '../icones';
import { pointsEclair } from '../../game/xp';
import { piegesDe } from '../../game/pieges';
import { chapitresPourRevision, noteSur20, EXAMEN, type ItemSession, type Mode } from '../../game/modes';
import { serieEntrainement, serieBoss, serieEclair, serieRevision, itemSurvie, itemGenere, dureeBoss, serieExamen, serieDepuisCles, cleItem } from '../../game/series';
import { decoderDefi, encoderDefi, routeDefi, type Defi } from '../../game/defi';
import { jouerSon, xpFlottant, secouer, celebrer, toast } from '../effets';
import { aller } from '../../router';
import { nombre } from '../../core/francais';

interface Config {
  mode: Mode;
  titre: string;
  /** Question suivante, ou null quand la série est finie. */
  suivante: (rang: number) => ItemSession | null;
  total: number | null;
  vies: number | null;
  chronoGlobal: number | null;
  chronoQuestion: ((i: ItemSession) => number) | null;
  multiplicateur: (combo: number, rang: number) => number;
  retour: string;
  /** Examen : pas de correction ni d'effet avant la fin ; copie corrigée au bilan. */
  differe?: boolean;
  /** Examen : le sujet (pour le partager en défi), et le défi relevé s'il y en a un. */
  sujet?: ItemSession[];
  defi?: Defi;
}

/** Chapitres complets nécessaires au mode : le chapitre joué, tous (Survie, éclair) ou ceux à réviser. */
function chapitresNecessaires(params: string[]): Promise<Chapitre[]> {
  const [mode, chapId] = params as [Mode, string?];
  if (mode === 'survie' || mode === 'eclair') return chargerTout();
  if (mode === 'revision') return chargerChapitres(chapitresPourRevision(INDEX.chapitres, etat.p, etat.aujourdhui()));
  if (mode === 'examen') return chargerChapitres(chapitresDe(chapId ?? '').map((c) => c.id));
  return chapId && chapitreParId(chapId) ? chargerChapitre(chapId).then((c) => [c]) : Promise.resolve([]);
}

function configurer(params: string[], chapitres: Chapitre[]): Config | string {
  const [mode, chapId, diffTxt] = params as [Mode, string?, string?];
  const rng = createRng(randomSeed());
  const chapitre = chapId ? chapitres.find((c) => c.id === chapId) : undefined;
  const diff = (['1', '2', '3'].includes(diffTxt ?? '') ? Number(diffTxt) : null) as Difficulte | null;
  const base = { vies: null, chronoGlobal: null, chronoQuestion: null, multiplicateur: () => 1 };
  const depuisListe = (l: ItemSession[]) => (rang: number) => l[rang] ?? null;

  switch (mode) {
    case 'entrainement': {
      if (!chapitre) return 'Chapitre introuvable.';
      const l = serieEntrainement(chapitre, etat.p, diff, rng);
      if (!l.length) return 'Aucune question pour cette difficulté.';
      return { ...base, mode, titre: `Entraînement · ${chapitre.titre}`, suivante: depuisListe(l), total: l.length, retour: `#/chapitre/${chapitre.id}/exercices` };
    }
    case 'infini': {
      if (!chapitre) return 'Chapitre introuvable.';
      if (!itemGenere(chapitre, 1, rng)) return "Ce chapitre n'a pas encore de générateur d'exercices.";
      return {
        ...base,
        mode,
        titre: `Exercices infinis · ${chapitre.titre}`,
        suivante: () => itemGenere(chapitre, diff ?? (1 + Math.floor(rng() * 3)) as Difficulte, rng),
        total: null,
        retour: `#/chapitre/${chapitre.id}/exercices`,
      };
    }
    case 'boss': {
      if (!chapitre) return 'Chapitre introuvable.';
      const l = serieBoss(chapitre, rng);
      return {
        ...base,
        mode,
        titre: `👹 Boss · ${chapitre.titre}`,
        suivante: depuisListe(l),
        total: l.length,
        vies: 3,
        chronoQuestion: (i) => dureeBoss(i.question),
        multiplicateur: () => 1.5,
        retour: `#/chapitre/${chapitre.id}`,
      };
    }
    case 'survie':
      return {
        ...base,
        mode,
        titre: '🛡️ Survie',
        suivante: (rang) => itemSurvie(chapitres, rang, rng),
        total: null,
        vies: 1,
        multiplicateur: (_c, rang) => 1 + Math.min(rang, 20) * 0.1,
        retour: '#/',
      };
    case 'eclair': {
      const l = serieEclair(chapitres, rng);
      return {
        ...base,
        mode,
        titre: '⚡ QCM éclair',
        suivante: depuisListe(l),
        total: l.length,
        chronoGlobal: 180,
        multiplicateur: (combo) => pointsEclair(combo) / 100,
        retour: '#/',
      };
    }
    case 'revision': {
      const l = serieRevision(chapitres, etat.p, etat.aujourdhui(), rng);
      if (!l.length) return 'Rien à réviser pour le moment : fais quelques exercices d\'abord !';
      return { ...base, mode, titre: '📅 Révision du jour', suivante: depuisListe(l), total: l.length, retour: '#/revision' };
    }
    case 'examen': {
      const matiere = matiereParId(chapId ?? '');
      if (!matiere || !chapitres.length) return 'Matière introuvable.';
      const defi = diffTxt ? decoderDefi(diffTxt) : null;
      if (diffTxt && (!defi || defi.matiere !== matiere.id)) return 'Ce lien de défi est invalide.';
      const l = defi ? serieDepuisCles(chapitres, defi.questions) : serieExamen(chapitres, rng);
      if (defi && l.length < defi.questions.length * 0.8)
        return 'Ce défi a été créé avec une autre version des questions : demande un nouveau lien à ton camarade.';
      return {
        ...base,
        mode,
        titre: `${defi ? '🤝 Défi' : '📝 Examen blanc'} · ${matiere.nom}`,
        suivante: depuisListe(l),
        total: l.length,
        chronoGlobal: EXAMEN.duree,
        retour: '#/',
        differe: true,
        sujet: l,
        defi: defi ?? undefined,
      };
    }
    default:
      return 'Mode inconnu.';
  }
}

/** Modes limités à un chapitre (son titre est dans celui de la séance). */
const UN_CHAPITRE = new Set(['entrainement', 'infini', 'boss']);

export function ecranSession(main: HTMLElement, params: string[]): () => void {
  return ecranApresChargement(main, () => chapitresNecessaires(params), (chapitres) => lancerSession(main, params, configurer(params, chapitres)));
}

function lancerSession(main: HTMLElement, params: string[], res: Config | string): () => void {
  if (typeof res === 'string') {
    main.append(h('div', { class: 'carte-vide' }, h('p', null, res), h('a', { class: 'btn', href: '#/' }, 'Retour à l\'accueil')));
    return () => {};
  }
  const cfg: Config = res;

  const s = { rang: 0, bonnes: 0, vies: cfg.vies, combo: 0, meilleurCombo: 0, score: 0, xp: 0, indices: 0, fini: false, ratees: 0, points: 0 };
  /** Examen : les questions traitées, revues (corrigées) au bilan. */
  const copie: ControleurQuestion[] = [];
  const reponsesExamen: InfoReponse[] = [];
  let ctrl: ControleurQuestion | null = null;
  let minuteur: ReturnType<typeof setInterval> | null = null;
  let finGlobale = cfg.chronoGlobal ? Date.now() + cfg.chronoGlobal * 1000 : 0;
  let avanceAuto: ReturnType<typeof setTimeout> | null = null;

  const barre = h('div', { class: 'session-barre' });
  // Chronomètre : barre + temps restant affiché À CÔTÉ (pas dans la barre).
  const chronoRempli = h('div', { class: 'chrono-rempli' });
  const chronoTexte = h('span', { class: 'chrono-texte', 'aria-live': 'off' });
  const chrono = h(
    'div',
    { class: 'chrono', hidden: !cfg.chronoGlobal && !cfg.chronoQuestion },
    icone('horloge', 'chrono-icone'),
    h('div', { class: 'chrono-piste' }, chronoRempli),
    chronoTexte,
  );
  const scene = h('div', { class: 'session-scene' });
  main.append(h('div', { class: `session mode-${cfg.mode}` }, barre, chrono, h('h1', { class: 'session-titre' }, cfg.titre), scene));

  function majBarre() {
    vider(barre);
    // Progression : questions faites / total (modes infinis : par paliers de 10).
    const fait = cfg.total ? s.rang / cfg.total : (s.rang % 10) / 10;
    ajouter(barre, [
      h('a', { class: 'quitter', href: cfg.retour, 'aria-label': 'Quitter la séance', title: 'Quitter' }, icone('croix')),
      h(
        'div',
        { class: 'progression', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(fait * 100)) },
        h('div', { class: 'progression-remplie', style: `width:${fait * 100}%` }),
      ),
      h(
        'span',
        { class: 'compteur', 'aria-label': cfg.total ? `Question ${Math.min(s.rang + 1, cfg.total)} sur ${cfg.total}` : `Question ${s.rang + 1}` },
        cfg.total ? `${Math.min(s.rang + 1, cfg.total)}/${cfg.total}` : `n° ${s.rang + 1}`,
      ),
      cfg.vies !== null ? h('span', { class: 'vies', 'aria-label': nombre(Math.max(0, s.vies!), 'vie') }, `❤️ ${Math.max(0, s.vies!)}`) : null,
      cfg.mode === 'eclair' ? h('span', { class: 'score' }, `⚡ ${s.score}`) : null,
      s.combo >= 2 && !cfg.differe ? h('span', { class: 'combo' }, `🔥 ×${s.combo}`) : null,
    ]);
  }

  function arreterMinuteur() {
    if (minuteur) clearInterval(minuteur);
    minuteur = null;
  }

  function lancerMinuteur(duree: number, surFin: () => void, fin = Date.now() + duree * 1000) {
    arreterMinuteur();
    const tic = () => {
      const reste = Math.max(0, fin - Date.now());
      chronoRempli.style.width = `${(reste / (duree * 1000)) * 100}%`;
      chronoTexte.textContent = `${Math.ceil(reste / 1000)} s`;
      chrono.classList.toggle('urgent', reste < 10_000);
      if (reste <= 0) {
        arreterMinuteur();
        surFin();
      }
    };
    tic();
    minuteur = setInterval(tic, 200);
  }

  /** Quitte la question affichée (en examen, on la garde pour la copie). */
  function quitterQuestion() {
    if (!ctrl) return;
    if (cfg.differe) {
      ctrl.figer();
      copie.push(ctrl);
    } else ctrl.detruire();
    ctrl = null;
  }

  function suivante() {
    if (avanceAuto) clearTimeout(avanceAuto);
    quitterQuestion();
    if (s.fini) return bilan();
    const item = cfg.total !== null && s.rang >= cfg.total ? null : cfg.suivante(s.rang);
    if (!item) return bilan();
    majBarre();
    const fin = cfg.vies !== null && s.vies === 1 && cfg.mode === 'boss';
    ctrl = afficherQuestion({
      question: item.question,
      // Séance d'un seul chapitre : il est déjà dans le titre, on ne le répète pas.
      surtitre: UN_CHAPITRE.has(cfg.mode)
        ? item.cle
          ? undefined
          : '🎲 Question générée'
        : `${item.chapitre.icone} ${item.chapitre.titre}${item.cle ? '' : ' · 🎲 générée'}`,
      indices: !cfg.differe,
      differe: cfg.differe,
      surIndice: () => {
        etat.modifier(payerIndice);
        s.indices++;
        return true;
      },
      surResultat: (r, info) => {
        if (cfg.chronoQuestion) arreterMinuteur();
        const correct = r.statut === 'correct';
        if (cfg.differe) {
          // Examen : rien ne doit trahir la justesse avant la fin (ni son, ni XP, ni badge) :
          // les réponses sont enregistrées toutes ensemble au bilan.
          reponsesExamen.push({ chapitre: item.chapitre.id, cle: item.cle, type: item.question.type, difficulte: item.question.difficulte, correct, credit: r.credit, pieges: piegesDe(item.question, r, item.cle) });
          s.points += correct ? 1 : (r.credit ?? 0);
          if (correct) s.bonnes++;
          else s.ratees++;
          s.rang++;
          majBarre();
          return;
        }
        s.combo = correct ? s.combo + 1 : 0;
        s.meilleurCombo = Math.max(s.meilleurCombo, s.combo);
        const mult = cfg.multiplicateur(s.combo, s.rang);
        const gain = etat.modifier((p) =>
          enregistrerReponse(
            p,
            { chapitre: item.chapitre.id, cle: item.cle, type: item.question.type, difficulte: item.question.difficulte, correct, multiplicateur: mult, credit: r.credit, pieges: piegesDe(item.question, r, item.cle) },
            etat.aujourdhui(),
          ),
        );
        s.xp += gain;
        if (correct) {
          s.bonnes++;
          if (cfg.mode === 'eclair') s.score += pointsEclair(s.combo);
          jouerSon('juste');
          xpFlottant(ctrl!.el.querySelector('.verdict') ?? ctrl!.el, `+${gain} XP`);
        } else {
          s.ratees++;
          jouerSon('faux');
          // On secoue seulement la zone de réponse (la barre du bas, fixe, ne doit pas bouger).
          secouer(ctrl!.el.querySelector('.zone-reponse') ?? ctrl!.el);
          if (gain > 0) xpFlottant(ctrl!.el.querySelector('.verdict') ?? ctrl!.el, `+${gain} XP`);
          if (s.vies !== null) s.vies--;
          if (s.vies === 0) s.fini = true;
        }
        if (info.expire && cfg.chronoGlobal && Date.now() >= finGlobale) s.fini = true;
        s.rang++;
        majBarre();
        // Mode infini : chaque tranche de 10 réponses compte comme une série terminée.
        if (cfg.mode === 'infini' && s.rang % TAILLE_SERIE_INFINIE === 0) serieTerminee();
        const bSuivant = ctrl!.el.querySelector('.btn-suivant');
        if (bSuivant && s.fini) bSuivant.textContent = 'Voir le bilan';
        // QCM éclair : on enchaîne automatiquement après une bonne réponse.
        if (cfg.mode === 'eclair' && correct && !s.fini) avanceAuto = setTimeout(suivante, 650);
      },
      surSuivant: () => suivante(),
      libelleSuivant: s.fini || (cfg.total !== null && s.rang + 1 >= cfg.total) ? 'Voir le bilan' : 'Continuer',
    });
    scene.replaceChildren(ctrl.el);
    if (fin) toast('💀 Dernière vie !', 'erreur');
    if (cfg.chronoQuestion) lancerMinuteur(cfg.chronoQuestion(item), () => ctrl?.expirer());
  }

  /** Série terminée : fait avancer le streak (une fois par jour) et le signale. */
  function serieTerminee() {
    const augmente = etat.modifier((p) => validerSerie(p, etat.aujourdhui()));
    if (augmente) toast(`🔥 Série validée : ${nombre(etat.p.streak.courant, 'jour')} d'affilée !`, 'niveau');
    else if (cfg.mode === 'infini') toast(`✅ Série de ${TAILLE_SERIE_INFINIE} terminée !`);
  }

  function bilan() {
    arreterMinuteur();
    s.fini = true;
    // Examen interrompu par le temps : la question affichée compte comme sans réponse.
    if (cfg.differe && ctrl) ctrl.expirer();
    quitterQuestion();
    const records: string[] = [];
    let titre = 'Série terminée';
    let gagne = s.bonnes > 0;
    const chapId = params[1];

    etat.modifier((p) => {
      if (cfg.mode === 'boss' && chapId) {
        const vaincu = s.vies! > 0 && s.rang >= (cfg.total ?? 10);
        const ancien = p.records.boss[chapId];
        p.records.boss[chapId] = {
          meilleur: Math.max(ancien?.meilleur ?? 0, s.bonnes),
          vaincu: (ancien?.vaincu ?? false) || vaincu,
          sansIndice: (ancien?.sansIndice ?? false) || (vaincu && s.indices === 0),
        };
        titre = vaincu ? '🏆 Boss vaincu !' : '💀 Le boss a gagné…';
        gagne = vaincu;
        if (vaincu) p.xp += 100;
        if (vaincu) records.push('+100 XP de victoire');
      }
      if (cfg.mode === 'survie') {
        titre = `🛡️ ${nombre(s.bonnes, 'bonne réponse', 'bonnes réponses')} d'affilée`;
        if (s.bonnes > p.records.survie) {
          p.records.survie = s.bonnes;
          records.push('🎉 Nouveau record de survie !');
        }
      }
      if (cfg.mode === 'eclair') {
        titre = `⚡ ${s.score} points`;
        if (s.score > p.records.eclair) {
          p.records.eclair = s.score;
          records.push('🎉 Nouveau record en QCM éclair !');
        }
        if (s.bonnes === 20) p.records.eclairParfait = true;
        p.records.meilleurCombo = Math.max(p.records.meilleurCombo, s.meilleurCombo);
      }
      if (cfg.mode === 'examen') {
        for (const r of reponsesExamen) s.xp += enregistrerReponse(p, r, etat.aujourdhui());
        const note = noteSur20(s.points, cfg.total ?? s.rang);
        const matiere = params[1];
        titre = `📝 ${String(note).replace('.', ',')}/20`;
        gagne = note >= 10;
        if (matiere && enregistrerExamen(p, matiere, note, etat.aujourdhui())) records.push('🎉 Nouvelle meilleure note !');
      }
      if (cfg.mode === 'revision' && s.rang > 0 && s.rang >= (cfg.total ?? 0)) {
        p.compteurs.revisions++;
        titre = '📅 Révision du jour terminée';
      }
    });
    // Atteindre le bilan = terminer une série (s'il y a eu au moins une réponse).
    if (s.rang > 0 && cfg.mode !== 'infini') serieTerminee();
    if (gagne && (cfg.mode === 'boss' || records.length)) {
      celebrer(80);
      jouerSon('niveau');
    } else if (cfg.mode === 'boss') jouerSon('boss');

    const total = cfg.total ?? s.rang;
    chrono.hidden = true;
    vider(barre);
    scene.replaceChildren(
      h(
        'section',
        { class: `bilan ${gagne ? 'bilan-gagne' : ''}` },
        h('div', { class: 'bilan-embleme', 'aria-hidden': 'true' }, gagne ? '🏆' : cfg.mode === 'boss' ? '💀' : '💪'),
        h('h2', null, titre),
        h(
          'div',
          { class: 'bilan-stats' },
          h('div', { class: 'tuile tuile-xp' }, h('span', null, 'XP gagnés'), h('strong', null, `⚡ ${s.xp}`)),
          h(
            'div',
            { class: 'tuile tuile-precision' },
            h('span', null, 'Précision'),
            h('strong', null, `🎯 ${s.rang ? Math.round((100 * s.bonnes) / s.rang) : 0} %`),
          ),
          cfg.differe ? null : h('div', { class: 'tuile tuile-combo' }, h('span', null, 'Combo max'), h('strong', null, `🔥 ${s.meilleurCombo}`)),
        ),
        h('p', { class: 'bilan-score' }, `${nombre(s.bonnes, 'bonne réponse', 'bonnes réponses')} sur ${Math.max(total, s.rang)}`),
        records.map((r) => h('p', { class: 'record' }, r)),
        s.ratees ? h('p', { class: 'note' }, s.ratees === 1 ? 'La question ratée reviendra dans ta révision du jour.' : `Les ${s.ratees} questions ratées reviendront dans ta révision du jour.`) : null,
        cfg.defi?.note !== undefined ? comparaisonDefi(noteSur20(s.points, cfg.total ?? s.rang), cfg.defi.note) : null,
        cfg.differe && copie.length ? h('a', { class: 'btn', href: '#copie', onclick: (e: Event) => (e.preventDefault(), document.getElementById('copie')?.scrollIntoView({ behavior: 'smooth' })) }, '📄 Revoir ma copie corrigée') : null,
        cfg.sujet ? boutonDefi(params[1], cfg.sujet.map(cleItem), noteSur20(s.points, cfg.total ?? s.rang)) : null,
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn btn-primaire', type: 'button', onclick: () => aller(location.hash.slice(1)) }, '🔁 Rejouer'),
          h('a', { class: 'btn', href: cfg.retour }, 'Retour'),
        ),
      ),
    );
    // Examen : la copie, question par question, avec la correction.
    if (cfg.differe && copie.length) {
      scene.append(h('section', { class: 'copie', id: 'copie' }, h('h2', null, '📄 Ta copie corrigée'), copie.map((c) => c.el)));
      copie.forEach((c) => c.reveler());
    }
  }

  if (cfg.chronoGlobal) {
    finGlobale = Date.now() + cfg.chronoGlobal * 1000;
    lancerMinuteur(cfg.chronoGlobal, () => {
      toast('⏰ Temps écoulé !', 'erreur');
      s.fini = true;
      bilan();
    }, finGlobale);
  }
  suivante();

  return () => {
    arreterMinuteur();
    if (avanceAuto) clearTimeout(avanceAuto);
    ctrl?.detruire();
    copie.forEach((c) => c.detruire());
  };
}

/** Résultat face à la note du camarade qui a lancé le défi. */
function comparaisonDefi(note: number, aBattre: number): HTMLElement {
  const fr = (n: number) => `${String(n).replace('.', ',')}/20`;
  const verdict = note > aBattre ? '🏆 Défi remporté !' : note === aBattre ? '🤝 Égalité parfaite.' : '💪 Pas cette fois : retente ta chance.';
  return h('p', { class: 'record' }, `${verdict} Ta note : ${fr(note)} · ton camarade : ${fr(aBattre)}.`);
}

/** Partager le même sujet (et sa note à battre) avec un camarade. */
function boutonDefi(matiere: string, questions: string[], note: number): HTMLElement {
  const lien = `${location.origin}${location.pathname}${routeDefi(encoderDefi({ matiere, questions, note }))}`;
  const partager = async () => {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Math Quest — défi', text: `Je défie ta note à cet examen blanc : ${String(note).replace('.', ',')}/20 à battre !`, url: lien }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(lien);
      toast('📋 Lien du défi copié : envoie-le à un camarade.');
    } catch {
      prompt('Copie ce lien et envoie-le à un camarade :', lien);
    }
  };
  return h('button', { class: 'btn btn-defi', type: 'button', 'data-lien': lien, onclick: () => void partager() }, '🤝 Défier un camarade (même sujet)');
}

