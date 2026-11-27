/**
 * Accord en nombre : « 1 question », « 3 questions », « 0 question » (0 et 1 au singulier).
 * Remplace les « question(s) » des messages. Sans dépendance : utilisable partout.
 */
export const accord = (n: number, singulier: string, pluriel = `${singulier}s`): string => (Math.abs(n) >= 2 ? pluriel : singulier);

/** Le nombre suivi du nom accordé : nombre(3, 'question') → « 3 questions ». */
export const nombre = (n: number, singulier: string, pluriel?: string): string => `${n} ${accord(n, singulier, pluriel)}`;
