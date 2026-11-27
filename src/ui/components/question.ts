/**
 * Composant « question » : affiche n'importe quel type de question, recueille la
 * réponse, la corrige et affiche le retour (explication par choix + correction
 * détaillée étape par étape).
 *
 * Raccourcis clavier :
 *   1–9   choisir une réponse (QCM unique : choisit ET valide)
 *   V / F vrai ou faux
 *   Entrée valider, puis passer à la suite
 *   H     indice
 */
import type { Question, Qcm, VraiFaux, TrouveErreur, Choix, Programme } from '../../core/schema';
import { LIBELLES_TYPE } from '../../core/types-question';
import { corriger, memeSortie, type ExecutionProgramme, type Reponse, type Resultat } from '../../core/grading';
import { executerTests, arreter, type IssueTests } from '../../c/client';
import { creerEditeurC } from './editeur-c';
import { apercuLatex, math } from '../../core/checker';
import { shuffle, createRng, randomSeed } from '../../core/random';
import { h, vider, ajouter } from '../dom';
import { riche, latex, rendreHtml } from '../texte';
import { COUT_INDICE } from '../../game/xp';
import { icone } from '../icones';

export interface OptionsQuestion {
  question: Question;
  /** Afficher le bouton « indice ». */
  indices?: boolean;
  /** Demande d'indice : renvoie false pour la refuser. */
  surIndice?: () => boolean;
  /** Réponse corrigée (jamais appelé pour une saisie invalide). */
  surResultat: (r: Resultat, info: { indiceUtilise: boolean; expire: boolean }) => void;
  /** Bouton « suivant » affiché après la correction. */
  surSuivant?: () => void;
  libelleSuivant?: string;
  /** Graine du mélange des choix (sinon aléatoire). */
  graine?: number;
  /** Petit bandeau au-dessus (ex. nom du chapitre). */
  surtitre?: string;
  /** Examen : la réponse est enregistrée sans correction ; celle-ci est montrée par `reveler()`. */
  differe?: boolean;
  /** Exercices « programme » : compile et exécute sur des entrées (par défaut, le compilateur C du navigateur). */
  executeur?: (source: string, entrees: string[], rappels: { etape?: (e: 'chargement' | 'compilation' | 'execution') => void }) => Promise<IssueTests>;
}

export interface ControleurQuestion {
  el: HTMLElement;
  /** Temps écoulé : verrouille et affiche la correction (en examen : verrouille seulement). */
  expirer(): void;
  /** Examen : quitte la question sans retirer l'élément (il sera revu à la fin). */
  figer(): void;
  /** Examen : affiche la correction de la réponse donnée (ou « sans réponse »). */
  reveler(): void;
  detruire(): void;
}

const ETOILES = ['', '★☆☆', '★★☆', '★★★'];
const BRAVOS = ['Excellent !', 'Bien joué !', 'Parfait !', 'Bravo !', 'Tu gères !', 'Impeccable !', 'Exact !'];

/** Réponse attendue en LaTeX lisible (« (2)+(3)*i » → « 2+3i »). */
function attenduTex(v: string | number): string {
  const s = String(v);
  try {
    return math.simplify(s).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch {
    return apercuLatex(s, ['x']) ?? s;
  }
}

export function afficherQuestion(opts: OptionsQuestion): ControleurQuestion {
  const q = opts.question;
  const rng = createRng(opts.graine ?? randomSeed());
  let repondu = false;
  let indiceUtilise = false;

  const zone = h('div', { class: 'zone-reponse' });
  const msg = h('p', { class: 'msg-invalide', role: 'alert' });
  const retour = h('section', { class: 'retour', hidden: true, 'aria-live': 'polite' });
  const btnValider = h('button', { class: 'btn btn-primaire', type: 'button', disabled: true }, 'Vérifier');
  const blocIndice = h('div', { class: 'indice', hidden: true });
  const btnIndice =
    opts.indices !== false && q.indice
      ? h(
          'button',
          { class: 'btn btn-indice', type: 'button', title: `Afficher un indice — coûte ${COUT_INDICE} XP (raccourci H)`, 'aria-label': `Afficher un indice, coûte ${COUT_INDICE} XP` },
          icone('ampoule'),
          h('span', { class: 'btn-indice-texte' }, 'Indice'),
          h('span', { class: 'cout' }, `−${COUT_INDICE} XP`),
        )
      : null;
  // Barre du bas (façon « leçon ») : Vérifier, puis verdict coloré + Continuer.
  const verdictZone = h('div', { class: 'verdict-zone' });
  const actions = h('div', { class: 'actions' }, btnIndice, btnValider);
  const pied = h('div', { class: 'pied' }, h('div', { class: 'pied-contenu' }, verdictZone, actions));

  const el = h(
    'article',
    { class: `question type-${q.type}` },
    h(
      'header',
      { class: 'question-entete' },
      opts.surtitre ? h('span', { class: 'surtitre' }, opts.surtitre) : null,
      h('span', { class: 'pastille' }, q.type === 'qcm' && q.multiple ? 'QCM · plusieurs réponses' : LIBELLES_TYPE[q.type]),
      h('span', { class: 'difficulte', title: `Difficulté ${q.difficulte}/3` }, ETOILES[q.difficulte]),
    ),
    riche('div', q.enonce, 'enonce'),
    zone,
    msg,
    blocIndice,
    retour,
    pied,
  );
  /** Active « Vérifier » dès qu'une réponse complète est saisie. */
  const majPret = () => {
    if (!repondu) btnValider.disabled = typeof lireReponse() === 'string';
  };
  el.addEventListener('input', majPret);
  el.addEventListener('change', majPret);
  el.addEventListener('click', majPret);

  /* ------------------- construction selon le type ------------------ */
  let lireReponse: () => Reponse | string; // string = message d'erreur
  let afficherCorrectionSpecifique: (r: Resultat) => void = () => {};
  /** Préparation asynchrone de la réponse (compilation et exécution d'un programme). */
  let preparer: (() => Promise<Reponse | string>) | null = null;
  let enVerification = false;
  /** Examen : résultat gardé jusqu'à `reveler()` ; `enRevue` pendant la relecture de la copie. */
  let resultatDiffere: Resultat | null = null;
  let enRevue = false;
  let quitter: () => void = () => {};
  /** Ajouté après la correction détaillée (ex. la solution d'un programme). */
  let complementCorrection: HTMLElement | null = null;
  const clavier: ((e: KeyboardEvent) => boolean)[] = [];

  if (q.type === 'qcm') construireQcm(q);
  else if (q.type === 'vrai-faux') construireVraiFaux(q);
  else if (q.type === 'trouve-erreur') construireErreur(q);
  else if (q.type === 'programme') construireProgramme(q);
  else construireSaisie();

  function construireChoix(choix: Choix[], multiple: boolean, nom: string, surChoix?: () => void) {
    const ordre = shuffle(
      choix.map((_, i) => i),
      rng,
    );
    const liste = h('ol', { class: 'choix', role: multiple ? 'group' : 'radiogroup' });
    const entrees: HTMLInputElement[] = [];
    const items: HTMLLIElement[] = [];
    ordre.forEach((orig, pos) => {
      const input = h('input', { type: multiple ? 'checkbox' : 'radio', name: nom, value: String(orig) });
      input.addEventListener('change', () => {
        majSelection();
        surChoix?.();
      });
      entrees.push(input);
      const li = h(
        'li',
        { class: 'choix-item' },
        h('label', null, input, h('kbd', null, String(pos + 1)), riche('span', choix[orig].texte, 'choix-texte')),
      );
      items.push(li);
      liste.appendChild(li);
    });
    function majSelection() {
      items.forEach((li, k) => li.classList.toggle('choisi', entrees[k].checked));
    }
    return {
      liste,
      ordre,
      entrees,
      items,
      basculer(pos: number) {
        const e = entrees[pos];
        if (!e || repondu) return;
        e.checked = multiple ? !e.checked : true;
        majSelection();
        surChoix?.();
      },
      selection: () => entrees.filter((e) => e.checked).map((e) => Number(e.value)),
      /** Coloration + explication de chaque choix après la réponse. */
      reveler(choixSel: number[]) {
        ordre.forEach((orig, pos) => {
          const c = choix[orig];
          const li = items[pos];
          const coche = choixSel.includes(orig);
          li.classList.add(c.correct ? 'juste' : coche ? 'faux' : 'neutre');
          if (c.correct && !coche && multiple) li.classList.add('oublie');
          entrees[pos].disabled = true;
          li.appendChild(h('div', { class: 'explication', html: `${c.correct ? '✔' : '✘'} ${rendreHtml(c.explication)}` }));
        });
      },
    };
  }

  function construireQcm(qq: Qcm) {
    const c = construireChoix(qq.choix, qq.multiple, `q-${qq.id}`);
    ajouter(zone, [qq.multiple ? h('p', { class: 'consigne' }, 'Coche toutes les bonnes réponses (et aucune mauvaise).') : null, c.liste]);
    lireReponse = () => {
      const s = c.selection();
      return s.length ? { type: 'qcm', choix: s } : 'Sélectionne au moins une réponse.';
    };
    afficherCorrectionSpecifique = () => c.reveler(c.selection());
    clavier.push((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= c.entrees.length) {
        c.basculer(n - 1);
        if (!qq.multiple) void valider();
        return true;
      }
      return false;
    });
  }

  function construireVraiFaux(qq: VraiFaux) {
    let valeur: boolean | null = null;
    const bV = h('button', { class: 'btn btn-vf', type: 'button' }, h('kbd', null, 'V'), ' Vrai');
    const bF = h('button', { class: 'btn btn-vf', type: 'button' }, h('kbd', null, 'F'), ' Faux');
    const choisir = (v: boolean) => {
      if (repondu) return;
      valeur = v;
      bV.classList.toggle('choisi', v);
      bF.classList.toggle('choisi', !v);
      bV.setAttribute('aria-pressed', String(v));
      bF.setAttribute('aria-pressed', String(!v));
    };
    bV.onclick = () => choisir(true);
    bF.onclick = () => choisir(false);
    const c = construireChoix(qq.justifications, false, `j-${qq.id}`);
    zone.append(h('div', { class: 'vf' }, bV, bF), h('p', { class: 'consigne' }, 'Puis choisis la bonne justification :'), c.liste);
    lireReponse = () => {
      if (valeur === null) return 'Choisis Vrai ou Faux.';
      const s = c.selection();
      if (!s.length) return 'Choisis une justification.';
      return { type: 'vrai-faux', valeur, justification: s[0] };
    };
    afficherCorrectionSpecifique = () => {
      (qq.reponse ? bV : bF).classList.add('juste');
      if (valeur !== qq.reponse) (valeur ? bV : bF).classList.add('faux');
      bV.disabled = bF.disabled = true;
      c.reveler(c.selection());
    };
    clavier.push((e) => {
      const k = e.key.toLowerCase();
      if (k === 'v' || k === 'f') {
        choisir(k === 'v');
        return true;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= c.entrees.length) {
        c.basculer(n - 1);
        return true;
      }
      return false;
    });
  }

  function construireErreur(qq: TrouveErreur) {
    let choisie: number | null = null;
    const lignes = qq.etapes.map((etape, i) => {
      const b = h('button', { class: 'etape', type: 'button', 'aria-pressed': 'false' }, h('kbd', null, String(i + 1)), riche('span', etape));
      b.onclick = () => selectionner(i);
      return b;
    });
    const selectionner = (i: number) => {
      if (repondu || i < 0 || i >= lignes.length) return;
      choisie = i;
      lignes.forEach((l, k) => {
        l.classList.toggle('choisi', k === i);
        l.setAttribute('aria-pressed', String(k === i));
      });
    };
    zone.append(h('p', { class: 'consigne' }, 'Clique sur la ligne qui contient l\'erreur :'), h('div', { class: 'etapes' }, lignes));
    lireReponse = () => (choisie === null ? 'Clique sur une ligne.' : { type: 'trouve-erreur', etape: choisie });
    afficherCorrectionSpecifique = () => {
      lignes.forEach((l, k) => {
        l.disabled = true;
        // Comme pour un QCM : la ligne à trouver en vert, un mauvais choix en rouge.
        if (k === qq.etapeFausse) l.classList.add('juste');
        else if (k === choisie) l.classList.add('faux');
      });
      lignes[qq.etapeFausse].after(h('div', { class: 'explication', html: `⚠️ ${rendreHtml(qq.explication)}` }));
    };
    clavier.push((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= lignes.length) {
        selectionner(n - 1);
        return true;
      }
      return false;
    });
  }

  function construireSaisie() {
    const qq = q as Extract<Question, { type: 'numerique' | 'expression' }>;
    const liste = qq.type === 'numerique' && Array.isArray(qq.reponse);
    const variables = qq.type === 'expression' ? qq.variables : [];
    const input = h('input', {
      type: 'text',
      class: 'saisie',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      inputmode: 'text',
      'aria-label': 'Ta réponse',
      placeholder: qq.type === 'expression' ? `ex : 2*x*exp(x^2)` : liste ? 'ex : 1+2i ; -1-2i' : 'ex : 3/4, sqrt(2)/2, pi/3',
    });
    const apercu = h('div', { class: 'apercu', 'aria-hidden': 'true' });
    const majApercu = () => {
      const t = input.value.trim();
      if (!t) return void (apercu.innerHTML = '');
      const morceaux = liste ? t.split(';') : [t];
      const tex = morceaux.map((m) => apercuLatex(m, variables));
      apercu.innerHTML = tex.every(Boolean) ? latex(tex.join(' \\;;\\; ')) : '<span class="apercu-erreur">…</span>';
    };
    input.addEventListener('input', majApercu);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (repondu) opts.surSuivant?.();
        else void valider();
      }
    });
    // Mini-clavier mathématique (pratique sur téléphone).
    const touches = ['^', '(', ')', '/', '*', 'sqrt(', 'pi', ...(qq.type === 'expression' ? ['exp(', 'ln(', 'x'] : ['i', ';'])];
    const clav = h(
      'div',
      { class: 'clavier-math' },
      touches.map((t) =>
        h(
          'button',
          {
            type: 'button',
            class: 'touche',
            onclick: () => {
              const d = input.selectionStart ?? input.value.length;
              const f = input.selectionEnd ?? d;
              input.value = input.value.slice(0, d) + t + input.value.slice(f);
              input.focus();
              input.setSelectionRange(d + t.length, d + t.length);
              majApercu();
            },
          },
          t === 'sqrt(' ? '√' : t === 'pi' ? 'π' : t,
        ),
      ),
    );
    const aideSaisie = h(
      'p',
      { class: 'aide-saisie' },
      'Syntaxe : ',
      ['x^2', 'sqrt(x)', 'exp(x)', 'ln(x)', 'pi', 'i'].flatMap((c) => [h('code', null, c), ' ']),
      '— multiplication implicite acceptée : ',
      h('code', null, '2x'),
      '.',
    );
    ajouter(zone, [
      liste ? h('p', { class: 'consigne' }, `${(qq.reponse as unknown[]).length} valeurs attendues, séparées par « ; ».`) : null,
      input,
      apercu,
      clav,
      aideSaisie,
    ]);
    lireReponse = () => (input.value.trim() ? { type: qq.type, saisie: input.value } : 'Écris ta réponse.') as Reponse | string;
    afficherCorrectionSpecifique = (r) => {
      input.disabled = true;
      // Le mini-clavier et l'aide de syntaxe ne servent plus : place à la correction.
      clav.remove();
      aideSaisie.remove();
      if (r.statut === 'correct') return;
      const att =
        qq.type === 'numerique'
          ? (Array.isArray(qq.reponse) ? qq.reponse : [qq.reponse]).map(attenduTex).join(' \\quad;\\quad ')
          : attenduTex(qq.reponse);
      retour.append(h('p', { class: 'attendu', html: `Réponse attendue : ${latex(att)}${qq.type === 'expression' && qq.aConstantePres ? ' (à une constante près)' : ''}` }));
    };
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  function construireProgramme(qq: Programme) {
    const executeur = opts.executeur ?? executerTests;
    const source = () => `${editeur.value}\n\n${qq.harnais}`;
    const ETAPES = { chargement: '⏳ Chargement du compilateur…', compilation: '⚙️ Compilation…', execution: '▶️ Exécution des tests…' } as const;
    const statut = h('p', { class: 'statut-c', role: 'status', 'aria-live': 'polite' }, matchMedia('(pointer: coarse)').matches ? '' : 'Ctrl + Entrée pour essayer sur l’exemple.');
    const consoleC = h('pre', { class: 'console-c', 'aria-label': 'Sortie du programme', tabindex: '0', hidden: true });
    const ecrire = (texte: string, classe?: string) => {
      consoleC.hidden = false;
      consoleC.append(classe ? h('span', { class: classe }, texte) : texte);
    };
    const exemple = qq.tests[0];
    let derniere: ExecutionProgramme | null = null;

    async function essayer() {
      if (repondu || enVerification) return;
      btnEssayer.disabled = true;
      consoleC.replaceChildren();
      const issue = await executeur(source(), [exemple.entree], { etape: (e) => (statut.textContent = ETAPES[e]) });
      btnEssayer.disabled = repondu;
      if ('compilation' in issue) {
        statut.textContent = '❌ Erreur de compilation';
        ecrire(issue.compilation, 'console-erreur');
      } else if ('sorties' in issue) {
        const s = issue.sorties[0];
        ecrire(s.sortie || '(aucune sortie)', s.sortie ? undefined : 'console-info');
        const ok = !('probleme' in s) && memeSortie(exemple.sortie, s.sortie);
        statut.textContent = 'probleme' in s ? '❌ Le programme a planté ou ne s’arrête pas' : ok ? '✅ Exemple réussi. Vérifie sur tous les tests !' : '⚠️ La sortie diffère de celle attendue';
      } else statut.textContent = issue.etape === 'arret' ? `⏱️ Interrompu (${issue.raison === 'temps' ? 'boucle infinie ?' : 'arrêt'})` : `❌ ${issue.message}`;
    }

    const editeur = creerEditeurC({ valeur: qq.code, surExecuter: () => void essayer(), lignes: Math.min(18, qq.code.split('\n').length + 4) });
    const btnEssayer = h('button', { class: 'btn', type: 'button', onclick: () => void essayer() }, '▶ Essayer sur l’exemple');
    const bloc = (titre: string, texte: string) => h('div', null, h('p', { class: 'etiquette-c' }, titre), h('pre', { class: 'sortie-attendue' }, texte || '(rien)'));
    zone.append(
      h('p', { class: 'consigne' }, `Complète le code. « Vérifier » le compile et le teste sur ${qq.tests.length} cas.`),
      editeur,
      h('div', { class: 'exemple-c' }, exemple.entree ? bloc('Exemple — entrée', exemple.entree) : null, bloc('Sortie attendue', exemple.sortie)),
      h('div', { class: 'actions-c' }, btnEssayer),
      statut,
      consoleC,
    );
    quitter = () => {
      if (enVerification || btnEssayer.disabled) arreter('utilisateur');
    };

    lireReponse = () => (editeur.value.trim() ? { type: 'programme', execution: { sorties: [] } } : 'Écris ton code.');
    preparer = async () => {
      consoleC.replaceChildren();
      consoleC.hidden = true;
      const issue = await executeur(
        source(),
        qq.tests.map((t) => t.entree),
        { etape: (e) => (statut.textContent = ETAPES[e]) },
      );
      if ('compilation' in issue) {
        statut.textContent = '❌ Erreur de compilation';
        ecrire(issue.compilation, 'console-erreur');
        return { type: 'programme', execution: issue };
      }
      if ('sorties' in issue) {
        statut.textContent = '';
        derniere = issue;
        return { type: 'programme', execution: issue };
      }
      if (issue.etape === 'arret' && issue.raison === 'temps') {
        statut.textContent = '⏱️ Temps dépassé : boucle infinie ?';
        derniere = { sorties: qq.tests.map(() => ({ probleme: 'temps' as const, sortie: '' })) };
        return { type: 'programme', execution: derniere };
      }
      statut.textContent = '';
      return issue.etape === 'arret' ? 'Vérification interrompue.' : `Le compilateur a rencontré un problème : ${issue.message}`;
    };
    afficherCorrectionSpecifique = () => {
      editeur.readOnly = true;
      btnEssayer.disabled = true;
      if (derniere && 'sorties' in derniere) {
        const sorties = derniere.sorties;
        const lignes = qq.tests.map((t, i) => {
          const s = sorties[i];
          const ok = !('probleme' in s) && memeSortie(t.sortie, s.sortie);
          return { t, s, ok, i };
        });
        const echec = lignes.find((l) => !l.ok);
        retour.append(
          h(
            'div',
            { class: 'tests-c' },
            h('p', { class: 'etiquette-c' }, 'Tests'),
            h('ul', null, lignes.map((l) => h('li', { class: l.ok ? 'test-ok' : 'test-ko' }, `${l.ok ? '✔' : '✘'} Test ${l.i + 1}`))),
            echec
              ? h(
                  'div',
                  { class: 'exemple-c' },
                  echec.t.entree ? bloc(`Test ${echec.i + 1} — entrée`, echec.t.entree) : null,
                  bloc('Sortie attendue', echec.t.sortie),
                  bloc(
                    'Ta sortie',
                    'probleme' in echec.s
                      ? { temps: '(temps dépassé : boucle infinie ?)', plantage: '(le programme a planté : pointeur invalide, tableau dépassé ?)', 'trop-long': '(sortie trop longue)' }[echec.s.probleme]
                      : echec.s.sortie,
                  ),
                )
              : null,
          ),
        );
      }
      complementCorrection = h('details', { class: 'solution-c' }, h('summary', null, 'Une solution possible'), riche('div', `\`\`\`c\n${qq.solution}\n\`\`\``));
    };
  }

  /* --------------------------- actions ---------------------------- */

  function montrerRetour(r: Resultat, expire: boolean) {
    repondu = true;
    btnValider.hidden = true;
    if (btnIndice) btnIndice.disabled = true;
    msg.textContent = '';
    el.classList.add(r.statut === 'correct' ? 'reussie' : 'ratee');
    vider(retour);
    const juste = r.statut === 'correct';
    const enPartie = !juste && (r.credit ?? 0) > 0;
    const titre = juste
      ? BRAVOS[Math.floor(Math.random() * BRAVOS.length)]
      : expire
        ? 'Temps écoulé !'
        : r.partiel || enPartie
          ? 'Presque !'
          : 'Pas tout à fait…';
    const detail = juste
      ? 'Bonne réponse.'
      : r.partiel
        ? 'La valeur ou la justification est fausse.'
        : enPartie && q.type === 'qcm'
          ? `En partie juste : ${Math.round(r.credit! * 100)} % des points (${r.bienTraites}/${q.choix.length} choix bien traités).`
        : r.testsReussis !== undefined && q.type === 'programme'
          ? `${r.testsReussis}/${q.tests.length} tests réussis. Compare ta sortie à celle attendue.`
          : r.bienTraites !== undefined && q.type === 'qcm' && q.multiple
          ? `${r.bienTraites}/${q.choix.length} choix bien traités. Regarde la correction.`
          : 'Regarde la correction juste au-dessus.';
    pied.classList.add(juste ? 'pied-juste' : 'pied-faux');
    vider(verdictZone);
    verdictZone.append(
      icone(juste ? 'coche' : expire ? 'horloge' : 'croix', 'verdict-icone'),
      h('div', null, h('p', { class: 'verdict' }, titre), h('p', { class: 'verdict-detail' }, detail)),
    );
    afficherCorrectionSpecifique(r);
    const details = h(
      'details',
      { class: 'correction', open: r.statut !== 'correct' },
      h('summary', null, 'Correction détaillée'),
      h('ol', null, q.correction.map((etape) => riche('li', etape))),
    );
    retour.append(details);
    if (complementCorrection) retour.append(complementCorrection);
    if (opts.surSuivant && !enRevue) {
      const b = h('button', { class: `btn btn-suivant ${juste ? 'btn-primaire' : 'btn-danger-plein'}`, type: 'button' }, opts.libelleSuivant ?? 'Continuer');
      b.onclick = () => opts.surSuivant?.();
      actions.replaceChildren(b);
      setTimeout(() => b.focus({ preventScroll: true }), 30);
    }
    retour.hidden = false;
    // Haut de la correction en vue (sous la réponse donnée), pas caché par la barre du bas.
    if (!enRevue) retour.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Examen : on verrouille la réponse et on passe à la suite, sans rien dévoiler. */
  function enregistrerDiffere(r: Resultat, expire: boolean) {
    repondu = true;
    resultatDiffere = expire ? null : r;
    btnValider.hidden = true;
    if (btnIndice) btnIndice.disabled = true;
    msg.textContent = '';
    zone.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>('input, button, textarea, select').forEach((e) => (e.disabled = true));
    pied.classList.add('pied-enregistre');
    vider(verdictZone);
    verdictZone.append(
      icone(expire ? 'horloge' : 'coche', 'verdict-icone'),
      h('div', null, h('p', { class: 'verdict' }, expire ? 'Temps écoulé' : 'Réponse enregistrée'), h('p', { class: 'verdict-detail' }, 'La correction sera donnée à la fin de l’examen.')),
    );
    if (opts.surSuivant) {
      const b = h('button', { class: 'btn btn-suivant btn-primaire', type: 'button' }, opts.libelleSuivant ?? 'Continuer');
      b.onclick = () => opts.surSuivant?.();
      actions.replaceChildren(b);
      setTimeout(() => b.focus({ preventScroll: true }), 30);
    }
    opts.surResultat(r, { indiceUtilise, expire });
  }

  async function valider() {
    if (repondu || enVerification) return;
    let rep = lireReponse();
    if (typeof rep === 'string') {
      msg.textContent = rep;
      return;
    }
    if (preparer) {
      enVerification = true;
      btnValider.disabled = true;
      msg.textContent = '';
      rep = await preparer();
      enVerification = false;
      btnValider.disabled = false;
      if (repondu) return; // temps écoulé pendant la vérification
      if (typeof rep === 'string') {
        msg.textContent = rep;
        return;
      }
    }
    const r = corriger(q, rep);
    if (r.statut === 'invalide') {
      msg.textContent = r.message ?? 'Réponse invalide.';
      return;
    }
    if (opts.differe) return enregistrerDiffere(r, false);
    montrerRetour(r, false);
    opts.surResultat(r, { indiceUtilise, expire: false });
  }

  function demanderIndice() {
    if (!btnIndice || indiceUtilise || repondu || !q.indice) return;
    if (opts.surIndice && !opts.surIndice()) return;
    indiceUtilise = true;
    btnIndice.disabled = true;
    btnIndice.replaceChildren(icone('ampoule'), h('span', { class: 'btn-indice-texte' }, 'Indice utilisé'));
    blocIndice.innerHTML = `<span class="indice-titre">💡 Indice</span> ${rendreHtml(q.indice)}`;
    blocIndice.hidden = false;
  }

  btnValider.onclick = () => void valider();
  if (btnIndice) btnIndice.onclick = demanderIndice;

  const surTouche = (e: KeyboardEvent) => {
    if (!el.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const cible = e.target as HTMLElement;
    if (cible?.tagName === 'TEXTAREA' || (cible?.tagName === 'INPUT' && (cible as HTMLInputElement).type === 'text')) return;
    if (e.key === 'Enter') {
      if (cible?.tagName === 'BUTTON' || cible?.tagName === 'SUMMARY') return; // laisser le bouton agir
      e.preventDefault();
      if (repondu) opts.surSuivant?.();
      else void valider();
      return;
    }
    if (repondu) return;
    if (e.key.toLowerCase() === 'h') {
      demanderIndice();
      return;
    }
    for (const f of clavier)
      if (f(e)) {
        majPret();
        return void e.preventDefault();
      }
  };
  document.addEventListener('keydown', surTouche);

  return {
    el,
    expirer() {
      if (repondu) return;
      const r: Resultat = { statut: 'incorrect' };
      if (opts.differe) return enregistrerDiffere(r, true);
      montrerRetour(r, true);
      opts.surResultat(r, { indiceUtilise, expire: true });
    },
    figer() {
      quitter();
      document.removeEventListener('keydown', surTouche);
    },
    reveler() {
      enRevue = true;
      el.classList.add('en-revue');
      pied.classList.remove('pied-enregistre');
      actions.replaceChildren(); // plus de « Continuer » dans la copie
      montrerRetour(resultatDiffere ?? { statut: 'incorrect' }, resultatDiffere === null);
    },
    detruire() {
      quitter();
      document.removeEventListener('keydown', surTouche);
      el.remove();
    },
  };
}
