/** Dates « calendaires » locales au format AAAA-MM-JJ (comparables comme des chaînes). */

export function jour(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

export function ajouterJours(j: string, n: number): string {
  const [a, m, d] = j.split('-').map(Number);
  return jour(new Date(a, m - 1, d + n));
}

/** Nombre de jours entre deux dates (b − a). */
export function ecartJours(a: string, b: string): number {
  const [a1, m1, d1] = a.split('-').map(Number);
  const [a2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}
