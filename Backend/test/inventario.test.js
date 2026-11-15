require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS, PRODUCTOS } = require('./helpers/db');
const { iniciarServidor, pedir, iniciarSesion } = require('./helpers/http');

let servidor;
let tokenEncargado;
let tokenVendedor;

before(async () => {
  servidor = await iniciarServidor();
});

beforeEach(async () => {
  await resetDatabase();
  tokenEncargado = await iniciarSesion(servidor.base, USUARIOS.encargado.correo);
  tokenVendedor = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo);
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

test('el módulo de inventario está restringido a administrador y encargado', async () => {
  const listar = await pedir(servidor.base, '/api/movimientos', { token: tokenVendedor });
  assert.equal(listar.estado, 403);

  const entrada = await pedir(servidor.base, '/api/movimientos/entrada', {
    metodo: 'POST',
    token: tokenVendedor,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 1 },
  });
  assert.equal(entrada.estado, 403);
});

test('registra una entrada y actualiza existencias y kárdex', async () => {
  const r = await pedir(servidor.base, '/api/movimientos/entrada', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 5, nota: 'Compra a proveedor' },
  });

  assert.equal(r.estado, 201);
  assert.equal(r.datos.existencias_resultantes, 15);

  const [productos] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(productos[0].existencias, 15);

  const [movimientos] = await pool.query(
    'SELECT tipo, cantidad, existencias_resultantes, nota FROM movimiento_inventario WHERE id_producto = ?',
    [PRODUCTOS.taladro.id]
  );
  assert.equal(movimientos.length, 1);
  assert.equal(movimientos[0].tipo, 'entrada');
  assert.equal(movimientos[0].cantidad, 5);
  assert.equal(movimientos[0].existencias_resultantes, 15);
  assert.equal(movimientos[0].nota, 'Compra a proveedor');
});

test('valida las entradas de inventario', async () => {
  const casos = [
    { cuerpo: { cantidad: 1 }, campo: 'producto' },
    { cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 0 }, campo: 'cantidad' },
    { cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: -2 }, campo: 'cantidad' },
    { cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 1, nota: 'x'.repeat(201) }, campo: 'nota' },
  ];

  for (const caso of casos) {
    const r = await pedir(servidor.base, '/api/movimientos/entrada', {
      metodo: 'POST',
      token: tokenEncargado,
      cuerpo: caso.cuerpo,
    });
    assert.equal(r.estado, 400, `debía fallar por ${caso.campo}`);
  }

  const inexistente = await pedir(servidor.base, '/api/movimientos/entrada', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: 9999, cantidad: 1 },
  });
  assert.equal(inexistente.estado, 404);
});

test('los ajustes exigen nota y no permiten dejar existencias negativas', async () => {
  const sinNota = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: -1 },
  });
  assert.equal(sinNota.estado, 400);

  const cero = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 0, nota: 'Ajuste' },
  });
  assert.equal(cero.estado, 400);

  const excesivo = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: -20, nota: 'Merma' },
  });
  assert.equal(excesivo.estado, 409);

  const [productos] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(productos[0].existencias, 10);

  const [movimientos] = await pool.query(
    'SELECT COUNT(*) AS total FROM movimiento_inventario WHERE id_producto = ?',
    [PRODUCTOS.taladro.id]
  );
  assert.equal(movimientos[0].total, 0);
});

test('aplica ajustes positivos y negativos con decimales', async () => {
  const negativo = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: -3, nota: 'Conteo físico' },
  });
  assert.equal(negativo.estado, 201);
  assert.equal(negativo.datos.existencias_resultantes, 7);

  const positivo = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 2.5, nota: 'Sobra de bodega' },
  });
  assert.equal(positivo.estado, 201);
  assert.equal(positivo.datos.existencias_resultantes, 9.5);
});

test('rechaza cantidades e identificadores no numéricos o infinitos', async () => {
  const entradas = [
    { id_producto: PRODUCTOS.taladro.id, cantidad: 'Infinity' },
    { id_producto: PRODUCTOS.taladro.id, cantidad: 'NaN' },
    { id_producto: 1.5, cantidad: 1 },
  ];
  for (const cuerpo of entradas) {
    const r = await pedir(servidor.base, '/api/movimientos/entrada', {
      metodo: 'POST',
      token: tokenEncargado,
      cuerpo,
    });
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
  }

  const ajusteInfinito = await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 'Infinity', nota: 'Ajuste' },
  });
  assert.equal(ajusteInfinito.estado, 400);
});

test('lista movimientos con filtros y valida el tipo', async () => {
  await pedir(servidor.base, '/api/movimientos/entrada', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 2 },
  });
  await pedir(servidor.base, '/api/movimientos/ajuste', {
    metodo: 'POST',
    token: tokenEncargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: -1, nota: 'Ajuste' },
  });

  const todos = await pedir(servidor.base, '/api/movimientos', { token: tokenEncargado });
  assert.equal(todos.estado, 200);
  assert.equal(todos.datos.total, 2);

  const entradas = await pedir(servidor.base, '/api/movimientos?tipo=entrada', {
    token: tokenEncargado,
  });
  assert.equal(entradas.datos.total, 1);
  assert.equal(entradas.datos.datos[0].tipo, 'entrada');

  const invalido = await pedir(servidor.base, '/api/movimientos?tipo=otro', {
    token: tokenEncargado,
  });
  assert.equal(invalido.estado, 400);
});
