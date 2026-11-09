const { bd } = require('./base');

const SELECT_USUARIO = `
  SELECT u.id_usuario, u.nombre_completo, u.correo, u.activo, u.id_rol, r.nombre AS rol
  FROM usuario u
  JOIN rol r ON r.id_rol = u.id_rol`;

// Para el login: es el único lugar donde se lee contrasena_hash
async function buscarPorCorreo(correo) {
  const [filas] = await bd().query(
    `SELECT u.id_usuario, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, r.nombre AS rol
     FROM usuario u
     JOIN rol r ON r.id_rol = u.id_rol
     WHERE u.correo = ?`,
    [correo]
  );
  return filas[0];
}

async function buscarActivoPorId(id) {
  const [filas] = await bd().query(
    `SELECT u.id_usuario AS id, u.nombre_completo AS nombre, u.correo, r.nombre AS rol
     FROM usuario u
     JOIN rol r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ? AND u.activo = TRUE`,
    [id]
  );
  return filas[0];
}

// Lo usa el middleware en cada petición: el estado y el rol salen siempre de la base de datos
async function buscarParaToken(id) {
  const [filas] = await bd().query(
    `SELECT u.id_usuario, u.activo, r.nombre AS rol
     FROM usuario u
     JOIN rol r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ?`,
    [id]
  );
  return filas[0];
}

async function listar({ buscar, rol, activo, limite, offset }) {
  const condiciones = [];
  const params = [];

  if (buscar) {
    condiciones.push('(u.nombre_completo LIKE ? OR u.correo LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`);
  }
  if (rol) {
    condiciones.push('u.id_rol = ?');
    params.push(rol);
  }
  if (activo === 'true' || activo === 'false') {
    condiciones.push('u.activo = ?');
    params.push(activo === 'true');
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM usuario u ${where}`, params);
  const [datos] = await bd().query(
    `${SELECT_USUARIO} ${where} ORDER BY u.nombre_completo LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
  return { datos, total };
}

async function listarRoles() {
  const [filas] = await bd().query('SELECT id_rol, nombre FROM rol ORDER BY id_rol');
  return filas;
}

// Devuelve undefined si el usuario no existe
async function rolDe(id) {
  const [filas] = await bd().query('SELECT id_rol FROM usuario WHERE id_usuario = ?', [id]);
  return filas[0]?.id_rol;
}

async function crear({ idRol, nombre, correo, hash }) {
  const [r] = await bd().query(
    'INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_hash) VALUES (?, ?, ?, ?)',
    [idRol, nombre, correo, hash]
  );
  return r.insertId;
}

async function actualizar(id, { nombre, correo, idRol }) {
  const [r] = await bd().query(
    'UPDATE usuario SET nombre_completo = ?, correo = ?, id_rol = ? WHERE id_usuario = ?',
    [nombre, correo, idRol, id]
  );
  return r.affectedRows;
}

async function cambiarEstado(id, activo) {
  const [r] = await bd().query('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [activo, id]);
  return r.affectedRows;
}

async function cambiarContrasena(id, hash) {
  const [r] = await bd().query('UPDATE usuario SET contrasena_hash = ? WHERE id_usuario = ?', [hash, id]);
  return r.affectedRows;
}

module.exports = {
  buscarPorCorreo, buscarActivoPorId, buscarParaToken, listar, listarRoles,
  rolDe, crear, actualizar, cambiarEstado, cambiarContrasena,
};