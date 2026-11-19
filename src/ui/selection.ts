/**
 * Matière affichée sur la carte (confort par appareil, stockée dans localStorage).
 * Si rien n'est stocké ou si la matière n'existe plus, on prend la première du catalogue.
 */
import { toutesLesMatieres } from '../core/loader';

const CLE = 'math-quest:matiere';

export function matiereSelectionnee(): string | undefined {
  const toutes = toutesLesMatieres();
  let id: string | null = null;
  try {
    id = localStorage.getItem(CLE);
  } catch {
    /* stockage indisponible */
  }
  return toutes.find((m) => m.id === id)?.id ?? toutes[0]?.id;
}

export function selectionnerMatiere(id: string): void {
  try {
    localStorage.setItem(CLE, id);
  } catch {
    /* stockage indisponible : la sélection n'est pas mémorisée */
  }
}
