import { describe, expect, test } from 'vitest';
import { nivelStock } from './stock';

describe('nivelStock', () => {
  test('sin existencias siempre está agotado', () => {
    expect(nivelStock(0, 0)).toEqual({ texto: 'Agotado', clase: 'agotado' });
    expect(nivelStock(-2, 10)).toEqual({ texto: 'Agotado', clase: 'agotado' });
  });

  test('la mitad del mínimo o menos es crítico', () => {
    expect(nivelStock(5, 10)).toEqual({ texto: 'Crítico', clase: 'critico' });
    expect(nivelStock(1, 2)).toEqual({ texto: 'Crítico', clase: 'critico' });
  });

  test('por debajo del mínimo es alerta y el mínimo exacto también', () => {
    expect(nivelStock(6, 10)).toEqual({ texto: 'Alerta', clase: 'alerta' });
    expect(nivelStock(10, 10)).toEqual({ texto: 'Alerta', clase: 'alerta' });
  });

  test('por encima del mínimo es normal', () => {
    expect(nivelStock(11, 10)).toEqual({ texto: 'Normal', clase: 'normal' });
    expect(nivelStock(1, 0)).toEqual({ texto: 'Normal', clase: 'normal' });
  });
});
