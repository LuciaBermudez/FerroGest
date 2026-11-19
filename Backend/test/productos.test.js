require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS, PRODUCTOS } = require('./helpers/db');
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

const PRODUCTO_NUEVO = {
  codigo: 'NEW-001',
  nombre: 'Producto Nuevo',
  descripcion: 'Creado por las pruebas',
  unidad_medida: 'unid',
  id_categoria: 1,
  precio_compra: 10000,
  precio_venta: 20000,
  porcentaje_iva: 19,
  stock_minimo: 1,
  existencias: 5,
};

test('el costo de compra solo lo ve el administrador', async () => {
  const admin = await pedir(servidor.base, '/api/productos?limite=100', { token: tokens.admin });
  assert.equal(admin.estado, 200);
  assert.ok(admin.datos.datos.every((p) => p.precio_compra !== undefined));

  for (const rol of ['vendedor', 'encargado']) {
    const r = await pedir(servidor.base, '/api/productos?limite=100', { token: tokens[rol] });
    assert.equal(r.estado, 200);
    assert.ok(r.datos.datos.every((p) => p.precio_compra === undefined));
  }

  const detalle = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}`, {
    token: tokens.vendedor,
  });
  assert.equal(detalle.estado, 200);
  assert.equal(detalle.datos.precio_compra, undefined);
});

test('filtra productos por búsqueda, estado de stock y estado activo', async () => {
  const buscar = await pedir(servidor.base, '/api/productos?buscar=CEM', { token: tokens.admin });
  assert.equal(buscar.datos.total, 1);
  assert.equal(buscar.datos.datos[0].codigo, 'CEM-001');

  const bajos = await pedir(servidor.base, '/api/productos?estado=bajo&limite=100', {
    token: tokens.admin,
  });
  assert.deepEqual(bajos.datos.datos.map((p) => p.codigo).sort(), ['CEM-001', 'PIN-001']);

  const inactivos = await pedir(servidor.base, '/api/productos?activo=false', { token: tokens.admin });
  assert.equal(inactivos.datos.total, 1);
  assert.equal(inactivos.datos.datos[0].codigo, 'INA-001');
});

test('un vendedor no puede crear ni modificar productos', async () => {
  const crear = await pedir(servidor.base, '/api/productos', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: PRODUCTO_NUEVO,
  });
  assert.equal(crear.estado, 403);

  const actualizar = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}`, {
    metodo: 'PUT',
    token: tokens.vendedor,
    cuerpo: { ...PRODUCTO_NUEVO, codigo: PRODUCTOS.taladro.codigo, nombre: PRODUCTOS.taladro.nombre },
  });
  assert.equal(actualizar.estado, 403);
});

test('el encargado crea productos y el stock inicial queda en el kárdex', async () => {
  const r = await pedir(servidor.base, '/api/productos', {
    metodo: 'POST',
    token: tokens.encargado,
    cuerpo: PRODUCTO_NUEVO,
  });
  assert.equal(r.estado, 201);

  const [productos] = await pool.query('SELECT * FROM producto WHERE id_producto = ?', [
    r.datos.id_producto,
  ]);
  assert.equal(productos[0].existencias, 5);
  assert.equal(productos[0].precio_compra, 0); // el encargado no define el costo

  const [movimientos] = await pool.query(
    'SELECT tipo, cantidad, existencias_resultantes, nota FROM movimiento_inventario WHERE id_producto = ?',
    [r.datos.id_producto]
  );
  assert.equal(movimientos.length, 1);
  assert.equal(movimientos[0].tipo, 'entrada');
  assert.equal(movimientos[0].cantidad, 5);
  assert.equal(movimientos[0].existencias_resultantes, 5);
  assert.equal(movimientos[0].nota, 'Inventario inicial');
});

test('valida los campos del producto y evita códigos duplicados', async () => {
  const invalido = await pedir(servidor.base, '/api/productos', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { ...PRODUCTO_NUEVO, codigo: '', nombre: '', unidad_medida: '', id_categoria: null, precio_venta: -1, porcentaje_iva: 150 },
  });
  assert.equal(invalido.estado, 400);
  assert.ok(invalido.datos.errores.length >= 5);

  const duplicado = await pedir(servidor.base, '/api/productos', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { ...PRODUCTO_NUEVO, codigo: PRODUCTOS.taladro.codigo },
  });
  assert.equal(duplicado.estado, 409);

  const categoriaInexistente = await pedir(servidor.base, '/api/productos', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { ...PRODUCTO_NUEVO, id_categoria: 9999 },
  });
  assert.equal(categoriaInexistente.estado, 400);
});

test('actualizar un producto no modifica existencias y respeta el costo según el rol', async () => {
  const cuerpo = {
    codigo: PRODUCTOS.taladro.codigo,
    nombre: 'Taladro renombrado',
    descripcion: 'Cambio de prueba',
    unidad_medida: 'unid',
    id_categoria: 1,
    precio_compra: 1,
    precio_venta: 123456,
    porcentaje_iva: 19,
    stock_minimo: 2,
    existencias: 999,
  };

  const encargado = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}`, {
    metodo: 'PUT',
    token: tokens.encargado,
    cuerpo,
  });
  assert.equal(encargado.estado, 200);

  const [trasEncargado] = await pool.query('SELECT * FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(trasEncargado[0].existencias, 10);
  assert.equal(trasEncargado[0].precio_compra, 70000);
  assert.equal(trasEncargado[0].precio_venta, 123456);

  const admin = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}`, {
    metodo: 'PUT',
    token: tokens.admin,
    cuerpo: { ...cuerpo, precio_compra: 80000 },
  });
  assert.equal(admin.estado, 200);

  const [trasAdmin] = await pool.query('SELECT precio_compra FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(trasAdmin[0].precio_compra, 80000);
});

test('rechaza NaN e Infinity en los campos numéricos', async () => {
  const casos = [
    { precio_venta: 'Infinity' },
    { precio_compra: 'Infinity' },
    { porcentaje_iva: 'Infinity' },
    { stock_minimo: 'NaN' },
    { existencias: '-5' },
    { id_categoria: 1.5 },
  ];

  for (const cambio of casos) {
    const r = await pedir(servidor.base, '/api/productos', {
      metodo: 'POST',
      token: tokens.admin,
      cuerpo: { ...PRODUCTO_NUEVO, ...cambio },
    });
    assert.equal(r.estado, 400, JSON.stringify(cambio));
  }
});

test('responde 404 al operar sobre un producto inexistente y valida el estado', async () => {
  const obtener = await pedir(servidor.base, '/api/productos/9999', { token: tokens.admin });
  assert.equal(obtener.estado, 404);

  const actualizar = await pedir(servidor.base, '/api/productos/9999', {
    metodo: 'PUT',
    token: tokens.admin,
    cuerpo: { ...PRODUCTO_NUEVO, codigo: 'X-999', nombre: 'X' },
  });
  assert.equal(actualizar.estado, 404);

  const estadoInvalido = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: 0 },
  });
  assert.equal(estadoInvalido.estado, 400);

  const estadoOk = await pedir(servidor.base, `/api/productos/${PRODUCTOS.taladro.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: false },
  });
  assert.equal(estadoOk.estado, 200);

  const inexistente = await pedir(servidor.base, '/api/productos/9999/estado', {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: false },
  });
  assert.equal(inexistente.estado, 404);
});
