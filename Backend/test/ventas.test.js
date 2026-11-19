require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS, PRODUCTOS, CLIENTES } = require('./helpers/db');
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
    vendedor2: await iniciarSesion(servidor.base, USUARIOS.vendedor2.correo),
  };
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

function crearVenta(cuerpo, token = tokens.vendedor) {
  return pedir(servidor.base, '/api/ventas', { metodo: 'POST', token, cuerpo });
}

const VENTA_MIXTA = {
  medio_pago: 'efectivo',
  porcentaje_descuento: 10,
  items: [
    { id_producto: PRODUCTOS.taladro.id, cantidad: 2 },
    { id_producto: PRODUCTOS.cemento.id, cantidad: 2 },
  ],
};

test('registra una venta con descuento e IVA, descuenta stock y deja kárdex', async () => {
  const r = await crearVenta(VENTA_MIXTA);

  assert.equal(r.estado, 201);
  assert.equal(r.datos.subtotal, 250000);
  assert.equal(r.datos.descuento, 25000);
  assert.equal(r.datos.iva_total, 36450);
  assert.equal(r.datos.total, 261450);
  assert.equal(r.datos.cambio, null);
  assert.equal(r.datos.numero, 1);
  assert.match(r.datos.ticket, /^TK-\d{4}-00001$/);

  const [productos] = await pool.query(
    'SELECT id_producto, existencias FROM producto WHERE id_producto IN (?, ?) ORDER BY id_producto',
    [PRODUCTOS.taladro.id, PRODUCTOS.cemento.id]
  );
  assert.deepEqual(productos.map((p) => p.existencias), [8, 1]);

  const [detalles] = await pool.query(
    'SELECT id_producto, cantidad, precio_unitario, porcentaje_iva FROM detalle_venta WHERE id_venta = ? ORDER BY id_producto',
    [r.datos.id_venta]
  );
  assert.equal(detalles.length, 2);
  assert.equal(detalles[0].cantidad, 2);
  assert.equal(detalles[0].precio_unitario, 100000);

  const [movimientos] = await pool.query(
    'SELECT tipo, cantidad, existencias_resultantes FROM movimiento_inventario WHERE id_venta = ? ORDER BY id_producto',
    [r.datos.id_venta]
  );
  assert.equal(movimientos.length, 2);
  assert.ok(movimientos.every((m) => m.tipo === 'venta'));
  assert.deepEqual(movimientos.map((m) => m.cantidad), [-2, -2]);
});

test('usa al Consumidor Final cuando no se indica cliente', async () => {
  const r = await crearVenta({
    medio_pago: 'tarjeta',
    items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }],
  });
  assert.equal(r.estado, 201);

  const [filas] = await pool.query('SELECT id_cliente FROM venta WHERE id_venta = ?', [
    r.datos.id_venta,
  ]);
  assert.equal(filas[0].id_cliente, CLIENTES.generico.id);
});

test('calcula el cambio y rechaza montos insuficientes', async () => {
  const base = {
    medio_pago: 'efectivo',
    items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }],
  };

  const insuficiente = await crearVenta({ ...base, monto_recibido: 100000 });
  assert.equal(insuficiente.estado, 400);

  const exacto = await crearVenta({ ...base, monto_recibido: 119000 });
  assert.equal(exacto.estado, 201);
  assert.equal(exacto.datos.cambio, 0);

  const conCambio = await crearVenta({ ...base, monto_recibido: 120000 });
  assert.equal(conCambio.estado, 201);
  assert.equal(conCambio.datos.total, 119000);
  assert.equal(conCambio.datos.cambio, 1000);
});

test('valida los datos de la venta', async () => {
  const casos = [
    { medio_pago: 'efectivo', items: [] },
    { medio_pago: 'bitcoin', items: [{ id_producto: 1, cantidad: 1 }] },
    { medio_pago: 'efectivo', porcentaje_descuento: 101, items: [{ id_producto: 1, cantidad: 1 }] },
    { medio_pago: 'efectivo', items: [{ id_producto: 1, cantidad: 0 }] },
    { medio_pago: 'efectivo', monto_recibido: -1, items: [{ id_producto: 1, cantidad: 1 }] },
    { medio_pago: 'efectivo', monto_recibido: 'Infinity', items: [{ id_producto: 1, cantidad: 1 }] },
  ];

  for (const cuerpo of casos) {
    const r = await crearVenta(cuerpo);
    assert.equal(r.estado, 400, JSON.stringify(cuerpo));
  }
});

test('rechaza clientes inválidos o inactivos', async () => {
  const inexistente = await crearVenta({
    medio_pago: 'efectivo',
    id_cliente: 9999,
    items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }],
  });
  assert.equal(inexistente.estado, 400);

  await pool.query('UPDATE cliente SET activo = FALSE WHERE id_cliente = ?', [CLIENTES.natural.id]);
  const inactivo = await crearVenta({
    medio_pago: 'efectivo',
    id_cliente: CLIENTES.natural.id,
    items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }],
  });
  assert.equal(inactivo.estado, 400);
});

test('rechaza productos inexistentes, inactivos o sin stock y no deja rastro', async () => {
  const inexistente = await crearVenta({
    medio_pago: 'efectivo',
    items: [{ id_producto: 9999, cantidad: 1 }],
  });
  assert.equal(inexistente.estado, 404);

  const inactivo = await crearVenta({
    medio_pago: 'efectivo',
    items: [{ id_producto: PRODUCTOS.inactivo.id, cantidad: 1 }],
  });
  assert.equal(inactivo.estado, 409);

  const sinStock = await crearVenta({
    medio_pago: 'efectivo',
    items: [{ id_producto: PRODUCTOS.pintura.id, cantidad: 1 }],
  });
  assert.equal(sinStock.estado, 409);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM venta');
  assert.equal(total, 0);

  const [taladro] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(taladro[0].existencias, 10);
});

test('si una línea falla, se revierte toda la venta', async () => {
  const r = await crearVenta({
    medio_pago: 'efectivo',
    items: [
      { id_producto: PRODUCTOS.taladro.id, cantidad: 1 },
      { id_producto: PRODUCTOS.pintura.id, cantidad: 1 },
    ],
  });
  assert.equal(r.estado, 409);

  const [taladro] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(taladro[0].existencias, 10);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM venta');
  assert.equal(total, 0);

  const [[{ movimientos }]] = await pool.query('SELECT COUNT(*) AS movimientos FROM movimiento_inventario');
  assert.equal(movimientos, 0);
});

test('une las líneas repetidas del mismo producto', async () => {
  const r = await crearVenta({
    medio_pago: 'efectivo',
    items: [
      { id_producto: PRODUCTOS.taladro.id, cantidad: 2 },
      { id_producto: PRODUCTOS.taladro.id, cantidad: 3 },
    ],
  });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.total, 595000);

  const [detalles] = await pool.query(
    'SELECT cantidad FROM detalle_venta WHERE id_venta = ?',
    [r.datos.id_venta]
  );
  assert.equal(detalles.length, 1);
  assert.equal(detalles[0].cantidad, 5);
});

test('el vendedor solo ve sus ventas y el administrador ve todas', async () => {
  const propia = await crearVenta(
    { medio_pago: 'efectivo', items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }] },
    tokens.vendedor
  );
  await crearVenta(
    { medio_pago: 'tarjeta', items: [{ id_producto: PRODUCTOS.cemento.id, cantidad: 1 }] },
    tokens.vendedor2
  );

  const listaVendedor = await pedir(servidor.base, '/api/ventas', { token: tokens.vendedor });
  assert.equal(listaVendedor.estado, 200);
  assert.equal(listaVendedor.datos.total, 1);
  assert.equal(listaVendedor.datos.datos[0].id_venta, propia.datos.id_venta);

  const listaAdmin = await pedir(servidor.base, '/api/ventas', { token: tokens.admin });
  assert.equal(listaAdmin.datos.total, 2);

  const porMedio = await pedir(servidor.base, '/api/ventas?medio_pago=tarjeta', {
    token: tokens.admin,
  });
  assert.equal(porMedio.datos.total, 1);
});

test('un vendedor no puede consultar la venta de otro, pero el administrador sí', async () => {
  const ajena = await crearVenta(
    { medio_pago: 'efectivo', items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }] },
    tokens.vendedor2
  );

  const vendedor = await pedir(servidor.base, `/api/ventas/${ajena.datos.id_venta}`, {
    token: tokens.vendedor,
  });
  assert.equal(vendedor.estado, 404);

  const admin = await pedir(servidor.base, `/api/ventas/${ajena.datos.id_venta}`, {
    token: tokens.admin,
  });
  assert.equal(admin.estado, 200);
  assert.equal(admin.datos.items.length, 1);
  assert.equal(admin.datos.id_usuario, undefined);
  assert.match(admin.datos.ticket, /^TK-\d{4}-/);
});

test('anular exige administrador, motivo y devuelve el stock una sola vez', async () => {
  const venta = await crearVenta({
    medio_pago: 'efectivo',
    items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 2 }],
  });
  assert.equal(venta.estado, 201);

  const vendedor = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}/anular`, {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { motivo: 'Intento sin permiso' },
  });
  assert.equal(vendedor.estado, 403);

  const sinMotivo = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}/anular`, {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: {},
  });
  assert.equal(sinMotivo.estado, 400);

  const motivoLargo = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}/anular`, {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { motivo: 'x'.repeat(201) },
  });
  assert.equal(motivoLargo.estado, 400);

  const ok = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}/anular`, {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { motivo: 'Error de cobro' },
  });
  assert.equal(ok.estado, 200);

  const [taladro] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(taladro[0].existencias, 10);

  const detalle = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}`, {
    token: tokens.admin,
  });
  assert.equal(detalle.datos.estado, 'anulada');
  assert.equal(detalle.datos.motivo_anulacion, 'Error de cobro');
  assert.equal(detalle.datos.anulada_por, 'Admin de Pruebas');

  const [movimientos] = await pool.query(
    "SELECT cantidad FROM movimiento_inventario WHERE tipo = 'anulacion' AND id_venta = ?",
    [venta.datos.id_venta]
  );
  assert.equal(movimientos.length, 1);
  assert.equal(movimientos[0].cantidad, 2);

  const repetida = await pedir(servidor.base, `/api/ventas/${venta.datos.id_venta}/anular`, {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { motivo: 'Otra vez' },
  });
  assert.equal(repetida.estado, 409);

  const inexistente = await pedir(servidor.base, '/api/ventas/9999/anular', {
    metodo: 'POST',
    token: tokens.admin,
    cuerpo: { motivo: 'No existe' },
  });
  assert.equal(inexistente.estado, 404);
});

test('las ventas simultáneas generan consecutivos únicos y descuentan el stock correcto', async () => {
  const respuestas = await Promise.all(
    Array.from({ length: 5 }, () =>
      crearVenta({
        medio_pago: 'efectivo',
        items: [{ id_producto: PRODUCTOS.taladro.id, cantidad: 1 }],
      })
    )
  );

  assert.ok(respuestas.every((r) => r.estado === 201), JSON.stringify(respuestas.map((r) => r.estado)));
  const numeros = respuestas.map((r) => r.datos.numero);
  assert.equal(new Set(numeros).size, 5);

  const [taladro] = await pool.query('SELECT existencias FROM producto WHERE id_producto = ?', [
    PRODUCTOS.taladro.id,
  ]);
  assert.equal(taladro[0].existencias, 5);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM venta');
  assert.equal(total, 5);
});
