require('./helpers/setup');

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDatabase, pool, USUARIOS } = require('./helpers/db');
const { iniciarServidor, pedir, iniciarSesion } = require('./helpers/http');

let servidor;

before(async () => {
  servidor = await iniciarServidor();
});

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await servidor.cerrar();
  await pool.end();
});

test('login correcto devuelve token y datos del usuario sin el hash', async () => {
  const r = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo: USUARIOS.admin.correo, contrasena: USUARIOS.admin.clave },
  });

  assert.equal(r.estado, 200);
  assert.equal(typeof r.datos.token, 'string');
  assert.equal(r.datos.usuario.correo, USUARIOS.admin.correo);
  assert.equal(r.datos.usuario.rol, 'Administrador');
  assert.equal(r.datos.usuario.contrasena_hash, undefined);
});

test('login rechaza contraseña incorrecta, correo inexistente y usuario inactivo con el mismo mensaje', async () => {
  const casos = [
    { correo: USUARIOS.admin.correo, contrasena: 'incorrecta' },
    { correo: 'nadie@test.local', contrasena: USUARIOS.admin.clave },
    { correo: USUARIOS.inactivo.correo, contrasena: USUARIOS.inactivo.clave },
  ];

  for (const caso of casos) {
    const r = await pedir(servidor.base, '/api/auth/login', { metodo: 'POST', cuerpo: caso });
    assert.equal(r.estado, 401);
    assert.equal(r.datos.mensaje, 'Credenciales incorrectas');
  }
});

test('login exige correo y contraseña', async () => {
  const r = await pedir(servidor.base, '/api/auth/login', { metodo: 'POST', cuerpo: { correo: '' } });
  assert.equal(r.estado, 400);
});

test('login tolera espacios alrededor del correo', async () => {
  const r = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo: `  ${USUARIOS.admin.correo}  `, contrasena: USUARIOS.admin.clave },
  });
  assert.equal(r.estado, 200);
});

test('perfil exige token válido y devuelve el usuario actual', async () => {
  const sinToken = await pedir(servidor.base, '/api/auth/perfil');
  assert.equal(sinToken.estado, 401);

  const tokenInvalido = await pedir(servidor.base, '/api/auth/perfil', { token: 'no-es-un-jwt' });
  assert.equal(tokenInvalido.estado, 401);

  const token = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo);
  const r = await pedir(servidor.base, '/api/auth/perfil', { token });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.correo, USUARIOS.vendedor.correo);
  assert.equal(r.datos.rol, 'Vendedor/Cajero');
});

test('un usuario desactivado pierde el acceso de inmediato aunque su token siga vigente', async () => {
  const token = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo);
  await pool.query('UPDATE usuario SET activo = FALSE WHERE id_usuario = ?', [USUARIOS.vendedor.id]);

  const r = await pedir(servidor.base, '/api/auth/perfil', { token });
  assert.equal(r.estado, 401);
});

test('un cambio de rol se aplica de inmediato sobre el token existente', async () => {
  const token = await iniciarSesion(servidor.base, USUARIOS.vendedor.correo);

  const antes = await pedir(servidor.base, '/api/usuarios', { token });
  assert.equal(antes.estado, 403);

  await pool.query('UPDATE usuario SET id_rol = 1 WHERE id_usuario = ?', [USUARIOS.vendedor.id]);
  const despues = await pedir(servidor.base, '/api/usuarios', { token });
  assert.equal(despues.estado, 200);
});

test('bloquea el login tras varios intentos fallidos seguidos', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await pedir(servidor.base, '/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: USUARIOS.admin.correo, contrasena: `mala-${i}` },
    });
    assert.equal(r.estado, 401);
  }

  const bloqueado = await pedir(servidor.base, '/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo: USUARIOS.admin.correo, contrasena: USUARIOS.admin.clave },
  });
  assert.equal(bloqueado.estado, 429);
  assert.match(bloqueado.datos.mensaje, /demasiados intentos/i);
});
