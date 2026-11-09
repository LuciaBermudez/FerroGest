const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    res.json(await Usuario.listarRoles());
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

    const { datos, total } = await Usuario.listar({
      buscar, rol, activo, limite, offset: (pagina - 1) * limite,
    });

    res.json({
      datos: datos.map((f) => ({ ...f, activo: Boolean(f.activo) })),
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
    const id = await Usuario.crear({
      idRol: d.id_rol,
      nombre: d.nombre_completo.trim(),
      correo: d.correo.trim().toLowerCase(),
      hash,
    });
    res.status(201).json({ id_usuario: id, mensaje: 'Usuario creado' });
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
    const rolActual = await Usuario.rolDe(id);
    if (rolActual === undefined) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    if (id === req.usuario.id && Number(d.id_rol) !== rolActual) {
      return res.status(409).json({ mensaje: 'No puedes cambiar tu propio rol' });
    }

    await Usuario.actualizar(id, {
      nombre: d.nombre_completo.trim(),
      correo: d.correo.trim().toLowerCase(),
      idRol: d.id_rol,
    });
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
    const filas = await Usuario.cambiarEstado(id, req.body.activo);
    if (filas === 0) {
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
    const filas = await Usuario.cambiarContrasena(req.params.id, hash);
    if (filas === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { roles, listar, crear, actualizar, cambiarEstado, cambiarContrasena };