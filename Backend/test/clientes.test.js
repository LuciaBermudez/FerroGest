require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS, CLIENTES } = require('./helpers/db');
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
  };
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

const CLIENTE_NATURAL = {
  tipo: 'persona_natural',
  tipo_documento: 'CC',
  documento: '12345678',
  nombre_razon_social: 'Cliente de Prueba',
  telefono: '3001234567',
  correo: 'cliente@test.local',
  direccion: 'Calle 10 # 20-30',
};

const CLIENTE_EMPRESA = {
  tipo: 'empresa',
  tipo_documento: 'NIT',
  documento: '901234567-8',
  nombre_razon_social: 'Empresa de Prueba S.A.S.',
  telefono: '',
  correo: '',
  direccion: '',
};

test('crea clientes persona natural y empresa', async () => {
  const natural = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: CLIENTE_NATURAL,
  });
  assert.equal(natural.estado, 201);

  const empresa = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: CLIENTE_EMPRESA,
  });
  assert.equal(empresa.estado, 201);
});

test('valida la relación entre tipo de cliente y tipo de documento', async () => {
  const empresaConCC = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_EMPRESA, tipo_documento: 'CC' },
  });
  assert.equal(empresaConCC.estado, 400);

  const personaConNIT = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_NATURAL, tipo_documento: 'NIT' },
  });
  assert.equal(personaConNIT.estado, 400);

  const documentoInvalido = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_NATURAL, documento: '12' },
  });
  assert.equal(documentoInvalido.estado, 400);
});

test('normaliza el documento sin puntos ni espacios y rechaza duplicados', async () => {
  const r = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_NATURAL, documento: '12.345.678' },
  });
  assert.equal(r.estado, 201);

  const [filas] = await pool.query('SELECT documento FROM cliente WHERE id_cliente = ?', [
    r.datos.id_cliente,
  ]);
  assert.equal(filas[0].documento, '12345678');

  const duplicado = await pedir(servidor.base, '/api/clientes', {
    metodo: 'POST',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_NATURAL, documento: '12 345 678' },
  });
  assert.equal(duplicado.estado, 409);
});

test('la lista de clientes no incluye al Consumidor Final', async () => {
  const r = await pedir(servidor.base, '/api/clientes?limite=100', { token: tokens.vendedor });
  assert.equal(r.estado, 200);
  assert.ok(r.datos.datos.every((c) => c.documento !== CLIENTES.generico.documento));
  assert.equal(r.datos.total, 2);
});

test('el administrador recibe el historial de compras y el vendedor no', async () => {
  const admin = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}`, {
    token: tokens.admin,
  });
  assert.equal(admin.estado, 200);
  assert.equal(admin.datos.num_compras, 0);
  assert.equal(admin.datos.total_comprado, 0);
  assert.deepEqual(admin.datos.compras, []);

  const vendedor = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}`, {
    token: tokens.vendedor,
  });
  assert.equal(vendedor.estado, 200);
  assert.equal(vendedor.datos.num_compras, undefined);
  assert.equal(vendedor.datos.compras, undefined);
});

test('permite editar un cliente y normaliza los datos', async () => {
  const r = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}`, {
    metodo: 'PUT',
    token: tokens.vendedor,
    cuerpo: { ...CLIENTE_NATURAL, documento: '1.020.458.912', correo: '  ANA@TEST.LOCAL  ' },
  });
  assert.equal(r.estado, 200);

  const [filas] = await pool.query('SELECT * FROM cliente WHERE id_cliente = ?', [
    CLIENTES.natural.id,
  ]);
  assert.equal(filas[0].documento, '1020458912');
  assert.equal(filas[0].correo, 'ana@test.local');
});

test('protege al Consumidor Final de ediciones y desactivaciones', async () => {
  const editar = await pedir(servidor.base, `/api/clientes/${CLIENTES.generico.id}`, {
    metodo: 'PUT',
    token: tokens.admin,
    cuerpo: { ...CLIENTE_NATURAL, documento: CLIENTES.generico.documento },
  });
  assert.equal(editar.estado, 409);

  const desactivar = await pedir(servidor.base, `/api/clientes/${CLIENTES.generico.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: false },
  });
  assert.equal(desactivar.estado, 409);
});

test('solo el administrador puede cambiar el estado de un cliente', async () => {
  const vendedor = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.vendedor,
    cuerpo: { activo: false },
  });
  assert.equal(vendedor.estado, 403);

  const admin = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: false },
  });
  assert.equal(admin.estado, 200);

  const [filas] = await pool.query('SELECT activo FROM cliente WHERE id_cliente = ?', [
    CLIENTES.natural.id,
  ]);
  assert.equal(filas[0].activo, 0);
});

test('responde 404 y 400 en los casos límite', async () => {
  const obtener = await pedir(servidor.base, '/api/clientes/9999', { token: tokens.admin });
  assert.equal(obtener.estado, 404);

  const actualizar = await pedir(servidor.base, '/api/clientes/9999', {
    metodo: 'PUT',
    token: tokens.admin,
    cuerpo: CLIENTE_NATURAL,
  });
  assert.equal(actualizar.estado, 404);

  const estado = await pedir(servidor.base, '/api/clientes/9999/estado', {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: true },
  });
  assert.equal(estado.estado, 404);

  const estadoInvalido = await pedir(servidor.base, `/api/clientes/${CLIENTES.natural.id}/estado`, {
    metodo: 'PATCH',
    token: tokens.admin,
    cuerpo: { activo: 'si' },
  });
  assert.equal(estadoInvalido.estado, 400);
});
