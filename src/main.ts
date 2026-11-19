/** Point d'entrée : en-tête, routes, démarrage. */
import './styles/main.css';
import { h } from './ui/dom';
import { creerHud } from './ui/components/hud';
import { route, demarrer } from './router';
import { ecranAccueil } from './ui/screens/accueil';
import { ecranChapitre } from './ui/screens/chapitre';
import { ecranSession } from './ui/screens/session';
import { ecranRevision } from './ui/screens/revision';
import { ecranStats } from './ui/screens/stats';
import { ecranBadges } from './ui/screens/badges';
import { ecranReglages } from './ui/screens/reglages';
import { brancherReglages } from './ui/effets';
import { etat } from './ui/etat';

brancherReglages(() => etat.p.reglages);

route('', ecranAccueil);
route('chapitre', ecranChapitre);
route('jouer', ecranSession);
route('revision', ecranRevision);
route('stats', ecranStats);
route('badges', ecranBadges);
route('reglages', ecranReglages);

/**
 * Décor de fond : vagues verticales sur les côtés (SVG en ligne, couleurs du dégradé de
 * l'application via les variables CSS), qui ondulent lentement. Purement décoratif : ignoré par les lecteurs d'écran.
 */
function creerDecor(): HTMLElement {
  /*
   * Bandes de vagues VERTICALES sur les bords gauche et droit de l'écran.
   * Vue : 200 × 1440 unités. Chaque bord ondule avec une période de 360 ; le tracé
   * descend jusqu'à 2880 pour qu'en remontant de 1440 (4 périodes) il défile sans
   * couture. Le dégradé vert → bleu → violet → bleu → vert se répète tous les 1440 :
   * même distance que le défilement, donc pas de saut de couleur non plus.
   */
  const vague = (x: number, a: number) => {
    let d = `M0,0 L${x},0`;
    for (let y = 0; y < 2880; y += 360) d += ` C${x + a},${y + 120} ${x - a},${y + 240} ${x},${y + 360}`;
    return `${d} L0,2880 Z`;
  };
  const degrade = `
    <linearGradient id="degrade-vagues" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1440" spreadMethod="repeat">
      <stop offset="0" style="stop-color: var(--vert)"/>
      <stop offset="0.25" style="stop-color: var(--bleu)"/>
      <stop offset="0.5" style="stop-color: var(--violet)"/>
      <stop offset="0.75" style="stop-color: var(--bleu)"/>
      <stop offset="1" style="stop-color: var(--vert)"/>
    </linearGradient>`;
  const bande = (cote: 'gauche' | 'droite') => `
    <svg class="vagues vagues-${cote}" viewBox="0 0 200 1440" preserveAspectRatio="none">
      ${cote === 'gauche' ? `<defs>${degrade}</defs>` : ''}
      <path class="vague vague-1" fill="url(#degrade-vagues)" d="${vague(150, 26)}"/>
      <path class="vague vague-2" fill="url(#degrade-vagues)" d="${vague(105, 22)}"/>
      <path class="vague vague-3" fill="url(#degrade-vagues)" d="${vague(60, 16)}"/>
    </svg>`;
  const decor = h('div', { class: 'decor', 'aria-hidden': 'true' });
  decor.innerHTML = bande('gauche') + bande('droite');
  return decor;
}

const app = document.getElementById('app')!;
const main = h('main', { id: 'contenu', tabindex: '-1' });
app.append(creerDecor(), creerHud(), main);
// Réglage « animations » : coupe aussi le mouvement des vagues.
const majAnimations = () => document.documentElement.classList.toggle('sans-animations', !etat.p.reglages.animations);
majAnimations();
etat.surChangement(majAnimations);
demarrer(main);
