require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS } = require('./helpers/db');
const { iniciarServidor, pedir, iniciarSesion } = require('./helpers/http');

let servidor;
let tokens;

before(async () => {
  servidor = await iniciarServidor();
});

beforeEach(async () => {
  await resetDatabase();
  tokens = {
    admin: await iniciarSesion(servidor.base, USUARIOS.admin.correo),
    vendedor: await iniciarSesion(servidor.base, USUARIOS.vendedor.correo),
    encargado: await iniciarSesion(servidor.base, USUARIOS.encargado.correo),
  };
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

test('las categorías exigen sesión y se listan en orden alfabético', async () => {
  const sinToken = await pedir(servidor.base, '/api/categorias');
  assert.equal(sinToken.estado, 401);

  const r = await pedir(servidor.base, '/api/categorias', { token: tokens.vendedor });
  assert.equal(r.estado, 200);
  assert.deepEqual(
    r.datos.map((c) => c.nombre),
    ['Herramientas Eléctricas', 'Obra Gris', 'Pinturas']
  );
});

test('administrador y encargado crean categorías; el vendedor no', async () => {
  const vendedor = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { nombre: 'Plomería' },
  });
  assert.equal(vendedor.estado, 403);

  const admin = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { nombre: '  Plomería  ' },
  });
  assert.equal(admin.estado, 201);
  assert.equal(admin.datos.nombre, 'Plomería');

  const encargado = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.encargado,
    cuerpo: { nombre: 'Jardinería' },
  });
  assert.equal(encargado.estado, 201);
});

test('valida el nombre de la categoría y rechaza duplicados', async () => {
  const vacio = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { nombre: '   ' },
  });
  assert.equal(vacio.estado, 400);

  const largo = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { nombre: 'x'.repeat(51) },
  });
  assert.equal(largo.estado, 400);

  const duplicado = await pedir(servidor.base, '/api/categorias', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { nombre: 'Pinturas' },
  });
  assert.equal(duplicado.estado, 409);
});
