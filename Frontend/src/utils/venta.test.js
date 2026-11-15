import { describe, expect, test } from 'vitest';
import { calcularTotales, precioConIva, totalLinea } from './venta';

const taladro = { precio_venta: 100000, porcentaje_iva: 19 };
const cemento = { precio_venta: 25000, porcentaje_iva: 5 };

describe('calcularTotales', () => {
  test('un ticket vacío no genera cobros', () => {
    expect(calcularTotales([], 0)).toEqual({
      subtotal: 0,
      descuento: 0,
      ivaTotal: 0,
      total: 0,
      tarifaUnica: null,
    });
  });

  test('aplica el IVA de cada producto y redondea a dos decimales', () => {
    const totales = calcularTotales([{ producto: taladro, cantidad: 1 }], 0);
    expect(totales.subtotal).toBe(100000);
    expect(totales.ivaTotal).toBe(19000);
    expect(totales.total).toBe(119000);
    expect(totales.tarifaUnica).toBe(19);
  });

  test('el descuento se aplica antes del IVA, igual que en el backend', () => {
    // Misma venta que la prueba de integración: 2 taladros + 2 cementos con 10 %
    const totales = calcularTotales(
      [
        { producto: taladro, cantidad: 2 },
        { producto: cemento, cantidad: 2 },
      ],
      10
    );

    expect(totales.subtotal).toBe(250000);
    expect(totales.descuento).toBe(25000);
    expect(totales.ivaTotal).toBe(36450);
    expect(totales.total).toBe(261450);
    expect(totales.tarifaUnica).toBeNull(); // hay dos tarifas distintas
  });

  test('redondea el IVA a dos decimales', () => {
    const totales = calcularTotales(
      [{ producto: { precio_venta: 100.01, porcentaje_iva: 19 }, cantidad: 3 }],
      0
    );
    expect(totales.subtotal).toBe(300.03);
    expect(totales.ivaTotal).toBe(57.01);
    expect(totales.total).toBe(357.04);
  });
});

describe('precioConIva y totalLinea', () => {
  test('el precio de vitrina incluye el IVA redondeado', () => {
    expect(precioConIva(taladro)).toBe(119000);
    expect(precioConIva(cemento)).toBe(26250);
  });

  test('el total de la línea multiplica por la cantidad', () => {
    expect(totalLinea(taladro, 2)).toBe(238000);
    expect(totalLinea(cemento, 3)).toBe(78750);
  });
});
