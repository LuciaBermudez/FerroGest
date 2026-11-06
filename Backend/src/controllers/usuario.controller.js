const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nunca se selecciona contrasena_hash
const SELECT_USUARIO = `
  SELECT u.id_usuario, u.nombre_completo, u.correo, u.activo, u.id_rol, r.nombre AS rol
  FROM usuario u
  JOIN rol r ON r.id_rol = u.id_rol`;

function validarContrasena(contrasena) {
  // bcrypt solo procesa los primeros 72 caracteres
  if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 72) {
    return ['La contraseña debe tener entre 8 y 72 caracteres'];
  }
  return [];
}

function validar(d, { conContrasena }) {
  const errores = [];
  const nombre = d.nombre_completo?.trim();
  const correo = d.correo?.trim();

  if (!nombre) errores.push('El nombre es obligatorio');
  else if (nombre.length > 100) errores.push('El nombre no puede superar los 100 caracteres');
  if (!correo || correo.length > 100 || !REGEX_CORREO.test(correo)) errores.push('El correo no es válido');
  if (!d.id_rol) errores.push('El rol es obligatorio');
  if (conContrasena) errores.push(...validarContrasena(d.contrasena));
  return errores;
}

function errorDeBD(error, res) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ mensaje: 'El rol indicado no existe' });
  }
  console.error(error);
  res.status(500).json({ mensaje: 'Error del servidor' });
}

// GET /api/usuarios/roles
async function roles(req, res) {
  try {
    const [filas] = await pool.query('SELECT id_rol, nombre FROM rol ORDER BY id_rol');
    res.json(filas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// GET /api/usuarios?buscar=&rol=&activo=true|false&pagina=1&limite=10
async function listar(req, res) {
  try {
    const { buscar, rol, activo } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 10, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const offset = (pagina - 1) * limite;

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

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM usuario u ${where}`, params);
    const [filas] = await pool.query(
      `${SELECT_USUARIO} ${where} ORDER BY u.nombre_completo LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    res.json({
      datos: filas.map((f) => ({ ...f, activo: Boolean(f.activo) })),
      total,
      pagina,
      limite,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// POST /api/usuarios  { nombre_completo, correo, id_rol, contrasena }
async function crear(req, res) {
  const d = req.body;
  const errores = validar(d, { conContrasena: true });
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const hash = await bcrypt.hash(d.contrasena, 10);
    const [resultado] = await pool.query(
      'INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_hash) VALUES (?, ?, ?, ?)',
      [d.id_rol, d.nombre_completo.trim(), d.correo.trim().toLowerCase(), hash]
    );
    res.status(201).json({ id_usuario: resultado.insertId, mensaje: 'Usuario creado' });
  } catch (error) {
    errorDeBD(error, res);
  }
}

// PUT /api/usuarios/:id  { nombre_completo, correo, id_rol }  (la contraseña tiene su propia ruta)
async function actualizar(req, res) {
  const id = Number(req.params.id);
  const d = req.body;
  const errores = validar(d, { conContrasena: false });
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const [actual] = await pool.query('SELECT id_rol FROM usuario WHERE id_usuario = ?', [id]);
    if (actual.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    if (id === req.usuario.id && Number(d.id_rol) !== actual[0].id_rol) {
      return res.status(409).json({ mensaje: 'No puedes cambiar tu propio rol' });
    }

    await pool.query(
      'UPDATE usuario SET nombre_completo = ?, correo = ?, id_rol = ? WHERE id_usuario = ?',
      [d.nombre_completo.trim(), d.correo.trim().toLowerCase(), d.id_rol, id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    errorDeBD(error, res);
  }
}

// PATCH /api/usuarios/:id/estado  { "activo": true | false }
async function cambiarEstado(req, res) {
  const id = Number(req.params.id);

  if (typeof req.body.activo !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo "activo" debe ser true o false' });
  }
  if (id === req.usuario.id && req.body.activo === false) {
    return res.status(409).json({ mensaje: 'No puedes desactivarte a ti mismo' });
  }

  try {
    const [resultado] = await pool.query('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [
      req.body.activo,
      id,
    ]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: req.body.activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// PATCH /api/usuarios/:id/contrasena  { "contrasena": "nueva" }
async function cambiarContrasena(req, res) {
  const errores = validarContrasena(req.body.contrasena);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const hash = await bcrypt.hash(req.body.contrasena, 10);
    const [resultado] = await pool.query('UPDATE usuario SET contrasena_hash = ? WHERE id_usuario = ?', [
      hash,
      req.params.id,
    ]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { roles, listar, crear, actualizar, cambiarEstado, cambiarContrasena };