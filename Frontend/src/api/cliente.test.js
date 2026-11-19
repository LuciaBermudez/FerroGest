import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  api,
  borrarToken,
  ErrorApi,
  guardarToken,
  obtenerToken,
  registrarAlExpirarSesion,
} from './cliente';

// Solo se usan las propiedades que el cliente consulta de Response
const respuesta = (datos, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => datos,
});

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  registrarAlExpirarSesion(null);
  vi.unstubAllGlobals();
});

describe('almacenamiento del token', () => {
  test('guarda, lee y borra el token', () => {
    expect(obtenerToken()).toBeNull();
    guardarToken('abc.def.ghi');
    expect(obtenerToken()).toBe('abc.def.ghi');
    borrarToken();
    expect(obtenerToken()).toBeNull();
  });
});

describe('api', () => {
  test('hace GET a /api y devuelve el JSON', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuesta({ estado: 'OK' }));
    vi.stubGlobal('fetch', fetchFalso);

    await expect(api('/health')).resolves.toEqual({ estado: 'OK' });
    expect(fetchFalso).toHaveBeenCalledWith('/api/health', {
      method: 'GET',
      headers: {},
      body: undefined,
    });
  });

  test('envía el token y el cuerpo JSON cuando corresponde', async () => {
    guardarToken('token-de-prueba');
    const fetchFalso = vi.fn().mockResolvedValue(respuesta({ id: 1 }));
    vi.stubGlobal('fetch', fetchFalso);

    await api('/ventas', { metodo: 'POST', cuerpo: { medio_pago: 'efectivo' } });

    expect(fetchFalso).toHaveBeenCalledWith('/api/ventas', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-de-prueba',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ medio_pago: 'efectivo' }),
    });
  });

  test('convierte una respuesta de error en ErrorApi con mensaje y detalles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuesta(
          { mensaje: 'Datos inválidos', errores: ['El nombre es obligatorio'] },
          { ok: false, status: 400 }
        )
      )
    );

    const error = await api('/productos', { metodo: 'POST', cuerpo: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.message).toBe('Datos inválidos');
    expect(error.estado).toBe(400);
    expect(error.detalles).toEqual(['El nombre es obligatorio']);
  });

  test('usa un mensaje genérico si el servidor no envía uno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(null, { ok: false, status: 500 })));

    await expect(api('/dashboard')).rejects.toMatchObject({
      message: 'Ocurrió un error inesperado',
      estado: 500,
    });
  });

  test('avisa del 401 fuera del login para cerrar la sesión', async () => {
    const alExpirar = vi.fn();
    registrarAlExpirarSesion(alExpirar);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respuesta({ mensaje: 'Sesión inválida' }, { ok: false, status: 401 }))
    );

    await expect(api('/auth/perfil')).rejects.toMatchObject({ estado: 401 });
    expect(alExpirar).toHaveBeenCalledTimes(1);
  });

  test('un 401 del login no cierra la sesión', async () => {
    const alExpirar = vi.fn();
    registrarAlExpirarSesion(alExpirar);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respuesta({ mensaje: 'Credenciales incorrectas' }, { ok: false, status: 401 })
      )
    );

    await expect(
      api('/auth/login', { metodo: 'POST', cuerpo: { correo: 'a@b.c', contrasena: 'x' } })
    ).rejects.toMatchObject({ estado: 401 });
    expect(alExpirar).not.toHaveBeenCalled();
  });

  test('distingue un fallo de red de un error del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api('/health')).rejects.toMatchObject({
      message: 'No se pudo conectar con el servidor',
      estado: 0,
    });
  });

  test('si el cuerpo no es JSON válido devuelve null en lugar de romperse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      })
    );

    await expect(api('/health')).resolves.toBeNull();
  });
});
