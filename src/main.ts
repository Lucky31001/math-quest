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
 * Décor de fond : trois couches de vagues (SVG en ligne, couleurs pilotées par le CSS)
 * qui ondulent lentement. Purement décoratif : ignoré par les lecteurs d'écran.
 */
function creerDecor(): HTMLElement {
  // Tracé périodique (720 unités) sur 4320 unités pour une vue de 2880 : en décalant de
  // 1440 (deux périodes), la vague défile sans couture.
  const vague = (y: number, a: number) => {
    let d = `M0,${y}`;
    for (let x = 0; x < 4320; x += 720) d += ` C${x + 240},${y + a} ${x + 480},${y - a} ${x + 720},${y}`;
    return `${d} L4320,320 L0,320 Z`;
  };
  const decor = h('div', { class: 'decor', 'aria-hidden': 'true' });
  decor.innerHTML = `
    <svg class="vagues" viewBox="0 0 2880 320" preserveAspectRatio="none">
      <path class="vague vague-1" d="${vague(120, 55)}"/>
      <path class="vague vague-2" d="${vague(180, 45)}"/>
      <path class="vague vague-3" d="${vague(240, 35)}"/>
    </svg>`;
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
