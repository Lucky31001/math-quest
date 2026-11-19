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
import type { Question, Qcm, VraiFaux, TrouveErreur, Choix } from '../../core/schema';
import { LIBELLES_TYPE } from '../../core/schema';
import { corriger, type Reponse, type Resultat } from '../../core/grading';
import { apercuLatex, math } from '../../core/checker';
import { shuffle, createRng, randomSeed } from '../../core/random';
import { h, vider, ajouter } from '../dom';
import { riche, latex, rendreHtml } from '../texte';
import { COUT_INDICE } from '../../game/xp';

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
}

export interface ControleurQuestion {
  el: HTMLElement;
  /** Temps écoulé : verrouille et affiche la correction. */
  expirer(): void;
  detruire(): void;
}

const ETOILES = ['', '★☆☆', '★★☆', '★★★'];

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
  const btnValider = h('button', { class: 'btn btn-primaire', type: 'button' }, 'Valider');
  const blocIndice = h('div', { class: 'indice', hidden: true });
  const btnIndice =
    opts.indices !== false && q.indice
      ? h('button', { class: 'btn btn-fantome', type: 'button', title: `Raccourci : H` }, `💡 Indice (−${COUT_INDICE} XP)`)
      : null;

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
    h('div', { class: 'actions' }, btnIndice, btnValider),
    retour,
  );

  /* ------------------- construction selon le type ------------------ */
  let lireReponse: () => Reponse | string; // string = message d'erreur
  let afficherCorrectionSpecifique: (r: Resultat) => void = () => {};
  const clavier: ((e: KeyboardEvent) => boolean)[] = [];

  if (q.type === 'qcm') construireQcm(q);
  else if (q.type === 'vrai-faux') construireVraiFaux(q);
  else if (q.type === 'trouve-erreur') construireErreur(q);
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
        if (!qq.multiple) valider();
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
        if (k === qq.etapeFausse) l.classList.add('faux-cible');
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
        else valider();
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
    ajouter(zone, [
      liste ? h('p', { class: 'consigne' }, `${(qq.reponse as unknown[]).length} valeurs attendues, séparées par « ; ».`) : null,
      input,
      apercu,
      clav,
      h('p', { class: 'aide-saisie' }, 'Syntaxe : ', h('code', null, 'x^2'), ' ', h('code', null, 'sqrt(x)'), ' ', h('code', null, 'exp(x)'), ' ', h('code', null, 'ln(x)'), ' ', h('code', null, 'pi'), ' ', h('code', null, 'i'), ' — multiplication implicite acceptée : ', h('code', null, '2x'), '.'),
    ]);
    lireReponse = () => (input.value.trim() ? { type: qq.type, saisie: input.value } : 'Écris ta réponse.') as Reponse | string;
    afficherCorrectionSpecifique = (r) => {
      input.disabled = true;
      if (r.statut === 'correct') return;
      const att =
        qq.type === 'numerique'
          ? (Array.isArray(qq.reponse) ? qq.reponse : [qq.reponse]).map(attenduTex).join(' \\quad;\\quad ')
          : attenduTex(qq.reponse);
      retour.append(h('p', { class: 'attendu', html: `Réponse attendue : ${latex(att)}${qq.type === 'expression' && qq.aConstantePres ? ' (à une constante près)' : ''}` }));
    };
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  /* --------------------------- actions ---------------------------- */

  function montrerRetour(r: Resultat, expire: boolean) {
    repondu = true;
    btnValider.hidden = true;
    if (btnIndice) btnIndice.disabled = true;
    msg.textContent = '';
    el.classList.add(r.statut === 'correct' ? 'reussie' : 'ratee');
    vider(retour);
    const verdict =
      r.statut === 'correct'
        ? '✅ Bonne réponse !'
        : expire
          ? '⏰ Temps écoulé !'
          : r.partiel
            ? '🟠 Presque : la valeur ou la justification est fausse.'
            : r.bienTraites !== undefined && q.type === 'qcm' && q.multiple
              ? `❌ Raté (${r.bienTraites}/${q.choix.length} choix bien traités).`
              : '❌ Raté.';
    retour.append(h('p', { class: 'verdict' }, verdict));
    afficherCorrectionSpecifique(r);
    const details = h(
      'details',
      { class: 'correction', open: r.statut !== 'correct' },
      h('summary', null, 'Correction détaillée'),
      h('ol', null, q.correction.map((etape) => riche('li', etape))),
    );
    retour.append(details);
    if (opts.surSuivant) {
      const b = h('button', { class: 'btn btn-primaire btn-suivant', type: 'button' }, opts.libelleSuivant ?? 'Suivant →');
      b.onclick = () => opts.surSuivant?.();
      retour.append(b);
      setTimeout(() => b.focus({ preventScroll: true }), 30);
    }
    retour.hidden = false;
    retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function valider() {
    if (repondu) return;
    const rep = lireReponse();
    if (typeof rep === 'string') {
      msg.textContent = rep;
      return;
    }
    const r = corriger(q, rep);
    if (r.statut === 'invalide') {
      msg.textContent = r.message ?? 'Réponse invalide.';
      return;
    }
    montrerRetour(r, false);
    opts.surResultat(r, { indiceUtilise, expire: false });
  }

  function demanderIndice() {
    if (!btnIndice || indiceUtilise || repondu || !q.indice) return;
    if (opts.surIndice && !opts.surIndice()) return;
    indiceUtilise = true;
    btnIndice.disabled = true;
    blocIndice.innerHTML = `💡 ${rendreHtml(q.indice)}`;
    blocIndice.hidden = false;
  }

  btnValider.onclick = valider;
  if (btnIndice) btnIndice.onclick = demanderIndice;

  const surTouche = (e: KeyboardEvent) => {
    if (!el.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
    const cible = e.target as HTMLElement;
    if (cible?.tagName === 'INPUT' && (cible as HTMLInputElement).type === 'text') return;
    if (e.key === 'Enter') {
      if (cible?.tagName === 'BUTTON' || cible?.tagName === 'SUMMARY') return; // laisser le bouton agir
      e.preventDefault();
      if (repondu) opts.surSuivant?.();
      else valider();
      return;
    }
    if (repondu) return;
    if (e.key.toLowerCase() === 'h') {
      demanderIndice();
      return;
    }
    for (const f of clavier) if (f(e)) return void e.preventDefault();
  };
  document.addEventListener('keydown', surTouche);

  return {
    el,
    expirer() {
      if (repondu) return;
      const r: Resultat = { statut: 'incorrect' };
      montrerRetour(r, true);
      opts.surResultat(r, { indiceUtilise, expire: true });
    },
    detruire() {
      document.removeEventListener('keydown', surTouche);
      el.remove();
    },
  };
}
