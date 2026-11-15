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
    vendedor2: await iniciarSesion(servidor.base, USUARIOS.vendedor2.correo),
    encargado: await iniciarSesion(servidor.base, USUARIOS.encargado.correo),
  };
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

function vender(token, idProducto = PRODUCTOS.taladro.id, cantidad = 1) {
  return pedir(servidor.base, '/api/ventas', {
    metodo: 'POST',
    token,
    cuerpo: { medio_pago: 'efectivo', items: [{ id_producto: idProducto, cantidad }] },
  });
}

test('el dashboard del administrador incluye ventas, stock, clientes y medios de pago', async () => {
  await vender(tokens.vendedor);

  const r = await pedir(servidor.base, '/api/dashboard?periodo=mes', { token: tokens.admin });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.rol, 'Administrador');

  for (const clave of ['ventas_hoy', 'ventas_mes', 'stock', 'clientes', 'resumen', 'medios_pago', 'top_productos']) {
    assert.ok(clave in r.datos, `falta ${clave}`);
  }
  assert.equal(r.datos.resumen.num_ventas, 1);
  assert.equal(r.datos.resumen.total_vendido, 119000);
  assert.equal(r.datos.ventas_hoy.total, 119000);
});

test('el dashboard del vendedor solo muestra sus propias ventas y no expone clientes', async () => {
  await vender(tokens.vendedor, PRODUCTOS.taladro.id, 1); // 119.000
  await vender(tokens.vendedor2, PRODUCTOS.cemento.id, 2); // 52.500

  const r = await pedir(servidor.base, '/api/dashboard?periodo=mes', { token: tokens.vendedor });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.rol, 'Vendedor/Cajero');
  assert.equal(r.datos.ventas_mes.total, 119000);
  assert.equal(r.datos.resumen.total_vendido, 119000);
  assert.equal(r.datos.clientes, undefined);
  assert.ok(!('clientes' in r.datos));
});

test('el dashboard del encargado muestra inventario y movimientos sin cifras de dinero', async () => {
  await pedir(servidor.base, '/api/movimientos/entrada', {
    metodo: 'POST',
    token: tokens.encargado,
    cuerpo: { id_producto: PRODUCTOS.taladro.id, cantidad: 4, nota: 'Reposición' },
  });

  const r = await pedir(servidor.base, '/api/dashboard?periodo=mes', { token: tokens.encargado });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.rol, 'Encargado del Inventario');

  for (const clave of ['stock', 'criticos', 'entradas', 'ultimos_movimientos']) {
    assert.ok(clave in r.datos, `falta ${clave}`);
  }
  assert.equal(r.datos.entradas.unidades, 4);
  assert.equal(r.datos.ultimos_movimientos.length, 1);
  assert.equal(r.datos.ventas_hoy, undefined);
  assert.equal(r.datos.resumen, undefined);
});

test('valida el periodo y exige sesión', async () => {
  const sinToken = await pedir(servidor.base, '/api/dashboard');
  assert.equal(sinToken.estado, 401);

  const invalido = await pedir(servidor.base, '/api/dashboard?periodo=año', { token: tokens.admin });
  assert.equal(invalido.estado, 400);
});

test('un rol sin dashboard recibe 403', async () => {
  await pool.query("INSERT INTO rol (id_rol, nombre) VALUES (4, 'Auditor')");
  await pool.query(
    "INSERT INTO usuario (id_usuario, id_rol, nombre_completo, correo, contrasena_hash) SELECT 6, 4, 'Auditor', 'auditor@test.local', contrasena_hash FROM usuario WHERE id_usuario = 1"
  );
  const token = await iniciarSesion(servidor.base, 'auditor@test.local');

  const r = await pedir(servidor.base, '/api/dashboard', { token });
  assert.equal(r.estado, 403);
});
