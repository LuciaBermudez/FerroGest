require('./helpers/setup');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool } = require('./helpers/db');
const { iniciarServidor, pedir } = require('./helpers/http');

let servidor;

before(async () => {
  await resetDatabase();
  servidor = await iniciarServidor();
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

test('health responde en JSON con el estado de la base de datos', async () => {
  const r = await pedir(servidor.base, '/api/health');
  assert.equal(r.estado, 200);
  assert.equal(r.datos.estado, 'OK');
  assert.equal(r.datos.backend, 'FerroGest');
  assert.equal(r.datos.baseDatos, 'ferrogest_test');
});

test('una ruta inexistente devuelve 404 en JSON, no HTML', async () => {
  const r = await pedir(servidor.base, '/api/no-existe');
  assert.equal(r.estado, 404);
  assert.equal(typeof r.datos, 'object');
  assert.match(r.cabeceras.get('content-type') || '', /application\/json/);
});

test('un JSON mal formado devuelve 400 en JSON', async () => {
  const r = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'POST',
    crudo: '{"correo": ',
  });
  assert.equal(r.estado, 400);
  assert.match(r.cabeceras.get('content-type') || '', /application\/json/);
});

test('CORS solo permite los orígenes configurados', async () => {
  const permitido = await pedir(servidor.base, '/api/health', {
    cabeceras: { Origin: 'http://localhost:5173' },
  });
  assert.equal(permitido.cabeceras.get('access-control-allow-origin'), 'http://localhost:5173');

  const ajeno = await pedir(servidor.base, '/api/health', {
    cabeceras: { Origin: 'https://sitio-malicioso.test' },
  });
  assert.equal(ajeno.cabeceras.get('access-control-allow-origin'), null);
});

test('el preflight de CORS responde para un origen permitido', async () => {
  const r = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'OPTIONS',
    cabeceras: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.ok([200, 204].includes(r.estado));
  assert.equal(r.cabeceras.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('incluye cabeceras básicas de seguridad', async () => {
  const r = await pedir(servidor.base, '/api/health');
  assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
  assert.equal(r.cabeceras.get('x-frame-options'), 'DENY');
  assert.equal(r.cabeceras.get('referrer-policy'), 'no-referrer');
  assert.equal(r.cabeceras.get('x-powered-by'), null);
});
