import { describe, expect, test } from 'vitest';
import {
  etiquetaDocumento,
  formatoCantidad,
  formatoCorto,
  formatoDocumento,
  formatoFecha,
  formatoNumero,
  formatoPesos,
  iniciales,
} from './formato';

describe('formatos numéricos', () => {
  test('usa el separador de miles colombiano', () => {
    expect(formatoNumero(1234)).toBe('1.234');
    expect(formatoNumero(null)).toBe('0');
    expect(formatoCantidad(1234.567)).toBe('1.234,57');
  });

  test('formatea pesos con símbolo y sin centavos', () => {
    expect(formatoPesos(1234.6)).toBe('$ 1.235');
    expect(formatoPesos(0)).toBe('$ 0');
    expect(formatoPesos(undefined)).toBe('$ 0');
  });

  test('abrevia solo los valores de un millón en adelante', () => {
    expect(formatoCorto(999999)).toBe('$ 999.999');
    expect(formatoCorto(2040000)).toBe('$2.04M');
  });
});

describe('documentos e iniciales', () => {
  test('pone puntos solo a CC y NIT numéricos', () => {
    expect(formatoDocumento('CC', '1020458912')).toBe('1.020.458.912');
    expect(formatoDocumento('NIT', '900548120-3')).toBe('900.548.120-3');
    expect(formatoDocumento('PASAPORTE', 'AB123456')).toBe('AB123456');
    expect(formatoDocumento('CC', '12-3-4')).toBe('12-3-4');
  });

  test('la etiqueta de la cédula lleva puntos', () => {
    expect(etiquetaDocumento('CC')).toBe('C.C.');
    expect(etiquetaDocumento('NIT')).toBe('NIT');
  });

  test('toma las iniciales de las dos primeras palabras', () => {
    expect(iniciales('Constructora Andina S.A.S.')).toBe('CA');
    expect(iniciales('  ana   pérez ')).toBe('AP');
    expect(iniciales('')).toBe('');
  });
});

describe('fechas', () => {
  test('formatoFecha muestra día, mes corto y año', () => {
    expect(formatoFecha('2024-05-24T12:00:00')).toBe('24 May 2024');
  });
});
