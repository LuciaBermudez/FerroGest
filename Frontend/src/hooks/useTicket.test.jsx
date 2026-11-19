import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CLIENTE_GENERICO, useTicket } from './useTicket';

const taladro = {
  id_producto: 1,
  codigo: 'TAL-001',
  precio_venta: 100000,
  porcentaje_iva: 19,
  existencias: 3,
};
const cemento = {
  id_producto: 2,
  codigo: 'CEM-001',
  precio_venta: 25000,
  porcentaje_iva: 5,
  existencias: 10,
};

describe('useTicket', () => {
  test('empieza vacío, con Consumidor Final y sin poder confirmar', () => {
    const { result } = renderHook(() => useTicket());

    expect(result.current.items).toEqual([]);
    expect(result.current.cliente).toBe(CLIENTE_GENERICO);
    expect(result.current.medioPago).toBe('efectivo');
    expect(result.current.descuento).toBe(0);
    expect(result.current.totales.total).toBe(0);
    expect(result.current.recibido).toBeNull();
    expect(result.current.cambio).toBeNull();
    expect(result.current.puedeConfirmar).toBe(false);
  });

  test('agrega productos y suma cantidades sin pasar de las existencias', () => {
    const { result } = renderHook(() => useTicket());

    act(() => result.current.agregar(taladro));
    expect(result.current.items).toEqual([{ producto: taladro, cantidad: 1 }]);

    for (let i = 0; i < 5; i++) act(() => result.current.agregar(taladro));
    expect(result.current.items[0].cantidad).toBe(3);
    expect(result.current.totales.total).toBe(357000);
    expect(result.current.puedeConfirmar).toBe(true);
  });

  test('mantiene una línea por producto', () => {
    const { result } = renderHook(() => useTicket());

    act(() => result.current.agregar(taladro));
    act(() => result.current.agregar(cemento));
    act(() => result.current.agregar(taladro));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((i) => i.cantidad)).toEqual([2, 1]);
    expect(result.current.totales.subtotal).toBe(225000);
  });

  test('cambiarCantidad respeta el rango 1..existencias', () => {
    const { result } = renderHook(() => useTicket());
    act(() => result.current.agregar(taladro));

    act(() => result.current.cambiarCantidad(taladro.id_producto, 0));
    expect(result.current.items[0].cantidad).toBe(1);

    act(() => result.current.cambiarCantidad(taladro.id_producto, 99));
    expect(result.current.items[0].cantidad).toBe(3);

    act(() => result.current.cambiarCantidad(taladro.id_producto, 2));
    expect(result.current.items[0].cantidad).toBe(2);
  });

  test('quitar elimina la línea del ticket', () => {
    const { result } = renderHook(() => useTicket());

    act(() => result.current.agregar(taladro));
    act(() => result.current.agregar(cemento));
    act(() => result.current.quitar(taladro.id_producto));

    expect(result.current.items).toEqual([{ producto: cemento, cantidad: 1 }]);
    expect(result.current.totales.total).toBe(26250);
  });

  test('el descuento se refleja en los totales', () => {
    const { result } = renderHook(() => useTicket());
    act(() => result.current.agregar(taladro));
    act(() => result.current.setDescuento(10));

    expect(result.current.totales.descuento).toBe(10000);
    expect(result.current.totales.ivaTotal).toBe(17100);
    expect(result.current.totales.total).toBe(107100);
  });

  test('el monto recibido calcula el cambio y bloquea montos insuficientes', () => {
    const { result } = renderHook(() => useTicket());
    act(() => result.current.agregar(taladro));

    act(() => result.current.setMontoRecibido('50000'));
    expect(result.current.recibido).toBe(50000);
    expect(result.current.cambio).toBe(-69000);
    expect(result.current.montoInsuficiente).toBe(true);
    expect(result.current.puedeConfirmar).toBe(false);

    act(() => result.current.setMontoRecibido('120000'));
    expect(result.current.cambio).toBe(1000);
    expect(result.current.montoInsuficiente).toBe(false);
    expect(result.current.puedeConfirmar).toBe(true);
  });

  test('reiniciar deja el ticket en blanco', () => {
    const { result } = renderHook(() => useTicket());

    act(() => result.current.agregar(taladro));
    act(() => result.current.setMedioPago('tarjeta'));
    act(() => result.current.setDescuento(15));
    act(() => result.current.setMontoRecibido('500000'));
    act(() => result.current.setCliente({ ...CLIENTE_GENERICO, id_cliente: 2 }));

    act(() => result.current.reiniciar());

    expect(result.current.items).toEqual([]);
    expect(result.current.cliente).toBe(CLIENTE_GENERICO);
    expect(result.current.medioPago).toBe('efectivo');
    expect(result.current.descuento).toBe(0);
    expect(result.current.montoRecibido).toBe('');
    expect(result.current.totales.total).toBe(0);
  });
});
