import { describe, it, expect } from 'vitest';
import { verifierExpression, verifierNumerique, normaliser, analyser, apercuLatex } from '../src/core/checker';

const ok = (s: string, attendu: string, opts = {}) => verifierExpression(s, attendu, opts).statut;

describe('normalisation de la saisie', () => {
  it('traduit les notations françaises', () => {
    expect(normaliser('ln(x)')).toBe('log(x)');
    expect(normaliser('arctan(x)')).toBe('atan(x)');
    expect(normaliser('ch(x) + sh(x)')).toBe('cosh(x) + sinh(x)');
    expect(normaliser('1,5')).toBe('1.5');
    expect(normaliser('x² − 1')).toBe('x^2 - 1');
    expect(normaliser('√2')).toBe('sqrt(2)');
    expect(normaliser('2π')).toBe('2pi');
  });
});

describe('expressions équivalentes', () => {
  it('reconnaît des formes développées / factorisées', () => {
    expect(ok('2x+2', '2*(x+1)')).toBe('correct');
    expect(ok('2(x+1)', '2*x+2')).toBe('correct');
    expect(ok('x(x+1)', 'x^2+x')).toBe('correct'); // x(…) lu comme une multiplication
    expect(ok('(x+1)^2', 'x^2+2x+1')).toBe('correct');
    expect(ok('sin(2x)', '2*sin(x)*cos(x)')).toBe('correct');
    expect(ok('e^(2x)', 'exp(x)^2')).toBe('correct');
    expect(ok('ln(x^2)', '2*log(x)', { domaine: [0.1, 5] })).toBe('correct');
  });
  it('refuse des expressions différentes', () => {
    expect(ok('2x+1', '2*(x+1)')).toBe('incorrect');
    expect(ok('x^2-2x+1', 'x^2+2x+1')).toBe('incorrect');
    expect(ok('cos(x)', 'sin(x)')).toBe('incorrect');
    // Égales en x = 0 mais pas ailleurs : l'échantillonnage aléatoire le détecte.
    expect(ok('x^3', 'x')).toBe('incorrect');
  });
  it('signale les saisies invalides sans les compter fausses', () => {
    expect(verifierExpression('2x+', 'x').statut).toBe('invalide');
    expect(verifierExpression('', 'x').statut).toBe('invalide');
    const v = verifierExpression('sinx', 'sin(x)');
    expect(v.statut).toBe('invalide');
    expect(v.message).toMatch(/sinx/);
    expect(verifierExpression('y+1', 'x+1').statut).toBe('invalide');
  });
  it('accepte X (notation des polynômes) pour x', () => {
    expect(ok('X^2+X+1', 'x^2+x+1')).toBe('correct');
  });
  it('gère plusieurs variables', () => {
    expect(ok('(a+b)^2', 'a^2+2a*b+b^2', { variables: ['a', 'b'] })).toBe('correct');
  });
  it('accepte une constante additive pour les primitives', () => {
    const opts = { aConstantePres: true };
    expect(ok('x^3/3', 'x^3/3', opts)).toBe('correct');
    expect(ok('x^3/3 + 5', 'x^3/3', opts)).toBe('correct');
    expect(ok('x^3/3 + C', 'x^3/3', opts)).toBe('correct');
    expect(ok('-cos(x)', '1-cos(x)', opts)).toBe('correct');
    expect(ok('x^3', 'x^3/3', opts)).toBe('incorrect');
    // Sans l'option, la constante compte.
    expect(ok('x^3/3 + 5', 'x^3/3')).toBe('incorrect');
  });
  it('travaille dans ℂ hors du domaine réel sans planter', () => {
    expect(ok('sqrt(x)', 'x^(1/2)')).toBe('correct');
  });
});

describe('réponses numériques', () => {
  it('compare des valeurs exactes', () => {
    expect(verifierNumerique('1/2', 0.5).statut).toBe('correct');
    expect(verifierNumerique('0,5', '1/2').statut).toBe('correct');
    expect(verifierNumerique('sqrt(2)/2', 'sqrt(2)/2').statut).toBe('correct');
    expect(verifierNumerique('1/sqrt(2)', 'sqrt(2)/2').statut).toBe('correct');
    expect(verifierNumerique('pi/3', '(1*pi/3)').statut).toBe('correct');
    expect(verifierNumerique('2pi/3', 'pi/3').statut).toBe('incorrect');
    expect(verifierNumerique('-3', 3).statut).toBe('incorrect');
  });
  it('accepte une approximation décimale d’au moins 3 décimales', () => {
    expect(verifierNumerique('1.414', 'sqrt(2)').statut).toBe('correct');
    expect(verifierNumerique('1.41', 'sqrt(2)').statut).toBe('incorrect');
    expect(verifierNumerique('0.333', '1/3').statut).toBe('correct');
  });
  it('compare des complexes', () => {
    expect(verifierNumerique('1+i', '(1)+(1)*i').statut).toBe('correct');
    expect(verifierNumerique('1-i', '1+i').statut).toBe('incorrect');
    expect(verifierNumerique('e^(i*pi)', -1).statut).toBe('correct');
  });
  it('gère les listes de valeurs dans le désordre', () => {
    const att = ['2+3i', '-2-3i'];
    expect(verifierNumerique('-2-3i ; 2+3i', att).statut).toBe('correct');
    expect(verifierNumerique('2+3i', att).statut).toBe('incorrect');
    expect(verifierNumerique('2+3i; 2+3i', att).statut).toBe('incorrect');
    expect(verifierNumerique('2+3i; -2+3i', att).statut).toBe('incorrect');
  });
  it('refuse une saisie contenant une variable', () => {
    expect(verifierNumerique('x+1', 2).statut).toBe('invalide');
  });
});

describe('aperçu LaTeX', () => {
  it('produit du LaTeX pour une saisie valide, null sinon', () => {
    expect(apercuLatex('x^2/2')).toContain('frac');
    expect(apercuLatex('2x+')).toBeNull();
  });
  it('analyser signale les fonctions inconnues', () => {
    const a = analyser('foo(x)', ['x']);
    expect(a.ok).toBe(false);
  });
});
