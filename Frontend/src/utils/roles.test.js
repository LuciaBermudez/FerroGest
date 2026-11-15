import { describe, expect, test } from 'vitest';
import { DESCRIPCION_ROL, MENU, ORDEN_ROLES, ROLES, rutaInicial } from './roles';

const rutasDe = (rol) =>
  MENU.flatMap((seccion) => seccion.items)
    .filter((item) => item.roles.includes(rol))
    .map((item) => item.ruta);

describe('roles', () => {
  test('todos los roles entran al dashboard y un rol desconocido al login', () => {
    expect(rutaInicial(ROLES.ADMIN)).toBe('/dashboard');
    expect(rutaInicial(ROLES.VENDEDOR)).toBe('/dashboard');
    expect(rutaInicial(ROLES.ENCARGADO)).toBe('/dashboard');
    expect(rutaInicial('Auditor')).toBe('/login');
    expect(rutaInicial(undefined)).toBe('/login');
  });

  test('el menú se filtra según el rol', () => {
    expect(rutasDe(ROLES.ADMIN)).toEqual([
      '/dashboard', '/ventas', '/inventario', '/clientes', '/historial-ventas', '/usuarios',
    ]);
    expect(rutasDe(ROLES.VENDEDOR)).toEqual([
      '/dashboard', '/ventas', '/clientes', '/historial-ventas',
    ]);
    expect(rutasDe(ROLES.ENCARGADO)).toEqual(['/dashboard', '/inventario']);
  });

  test('cada rol tiene descripción y un orden de presentación', () => {
    for (const rol of Object.values(ROLES)) {
      expect(DESCRIPCION_ROL[rol]).toBeTruthy();
    }
    expect(ORDEN_ROLES).toEqual([ROLES.VENDEDOR, ROLES.ADMIN, ROLES.ENCARGADO]);
  });
});
