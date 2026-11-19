require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS } = require('./helpers/db');
const { iniciarServidor, pedir, iniciarSesion } = require('./helpers/http');

let servidor;
let tokenAdmin;
let tokenVendedor;

before(async () => {
  servidor = await iniciarServidor();
});

beforeEach(async () => {
  await resetDatabase();
  tokenAdmin = await iniciarSesion(servidor.base, USUARIOS.admin.correo);
  tokenVendedor = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo);
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

test('el módulo de usuarios está restringido al administrador', async () => {
  for (const ruta of ['/api/usuarios', '/api/usuarios/roles']) {
    const r = await pedir(servidor.base, ruta, { token: tokenVendedor });
    assert.equal(r.estado, 403);
  }
});

test('lista los roles disponibles', async () => {
  const r = await pedir(servidor.base, '/api/usuarios/roles', { token: tokenAdmin });
  assert.equal(r.estado, 200);
  assert.deepEqual(
    r.datos.map((x) => x.nombre).sort(),
    ['Administrador', 'Encargado del Inventario', 'Vendedor/Cajero'].sort()
  );
});

test('crea un usuario válido y permite iniciar sesión con él', async () => {
  const r = await pedir(servidor.base, '/api/usuarios', {
    metodo: 'POST',
    token: tokenAdmin,
    cuerpo: {
      nombre_completo: 'Nuevo Vendedor',
      correo: 'Nuevo@Test.Local',
      id_rol: 2,
      contrasena: 'OtraClave123',
    },
  });

  assert.equal(r.estado, 201);
  assert.equal(typeof r.datos.id_usuario, 'number');

  const token = await iniciarSesion(servidor.base, 'nuevo@test.local', 'OtraClave123');
  assert.equal(typeof token, 'string');
});

test('valida los datos del usuario y rechaza correos duplicados', async () => {
  const invalido = await pedir(servidor.base, '/api/usuarios', {
    metodo: 'POST',
    token: tokenAdmin,
    cuerpo: { nombre_completo: '', correo: 'sin-arroba', id_rol: 2, contrasena: 'corta' },
  });
  assert.equal(invalido.estado, 400);
  assert.ok(invalido.datos.errores.length >= 3);

  const duplicado = await pedir(servidor.base, '/api/usuarios', {
    metodo: 'POST',
    token: tokenAdmin,
    cuerpo: {
      nombre_completo: 'Repetido',
      correo: USUARIOS.vendedor.correo,
      id_rol: 2,
      contrasena: 'Clave1234',
    },
  });
  assert.equal(duplicado.estado, 409);
});

test('no permite que el administrador se quite su propio rol ni se desactive a sí mismo', async () => {
  const cambioRol = await pedir(servidor.base, `/api/usuarios/${USUARIOS.admin.id}`, {
    metodo: 'PUT',
    token: tokenAdmin,
    cuerpo: { nombre_completo: 'Admin de Pruebas', correo: USUARIOS.admin.correo, id_rol: 2 },
  });
  assert.equal(cambioRol.estado, 409);

  const desactivarse = await pedir(servidor.base, `/api/usuarios/${USUARIOS.admin.id}/estado`, {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { activo: false },
  });
  assert.equal(desactivarse.estado, 409);
});

test('desactivar a otro usuario invalida su sesión de inmediato', async () => {
  const r = await pedir(servidor.base, `/api/usuarios/${USUARIOS.vendedor.id}/estado`, {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { activo: false },
  });
  assert.equal(r.estado, 200);

  const perfil = await pedir(servidor.base, '/api/auth/perfil', { token: tokenVendedor });
  assert.equal(perfil.estado, 401);
});

test('cambia la contraseña de otro usuario y la anterior deja de funcionar', async () => {
  const r = await pedir(servidor.base, `/api/usuarios/${USUARIOS.vendedor.id}/contrasena`, {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { contrasena: 'ClaveNueva123' },
  });
  assert.equal(r.estado, 200);

  const anterior = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo: USUARIOS.vendedor.correo, contrasena: USUARIOS.vendedor.clave },
  });
  assert.equal(anterior.estado, 401);

  const token = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo, 'ClaveNueva123');
  assert.equal(typeof token, 'string');
});

test('valida la nueva contraseña y responde 404 si el usuario no existe', async () => {
  const corta = await pedir(servidor.base, `/api/usuarios/${USUARIOS.vendedor.id}/contrasena`, {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { contrasena: '123' },
  });
  assert.equal(corta.estado, 400);

  const inexistente = await pedir(servidor.base, '/api/usuarios/9999/contrasena', {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { contrasena: 'ClaveValida123' },
  });
  assert.equal(inexistente.estado, 404);
});

test('responde 404 al actualizar o cambiar estado de un usuario inexistente', async () => {
  const actualizar = await pedir(servidor.base, '/api/usuarios/9999', {
    metodo: 'PUT',
    token: tokenAdmin,
    cuerpo: { nombre_completo: 'Fantasma', correo: 'fantasma@test.local', id_rol: 2 },
  });
  assert.equal(actualizar.estado, 404);

  const estado = await pedir(servidor.base, '/api/usuarios/9999/estado', {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { activo: true },
  });
  assert.equal(estado.estado, 404);
});

test('el cambio de estado exige un booleano', async () => {
  const r = await pedir(servidor.base, `/api/usuarios/${USUARIOS.vendedor.id}/estado`, {
    metodo: 'PATCH',
    token: tokenAdmin,
    cuerpo: { activo: 'false' },
  });
  assert.equal(r.estado, 400);
});
