const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.correo = ?`,
      [correo]
    );
    const usuario = filas[0];


    const valido =
      usuario && usuario.activo && (await bcrypt.compare(contrasena, usuario.contrasena_hash));

    if (!valido) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre_completo,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function perfil(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT u.id_usuario AS id, u.nombre_completo AS nombre, u.correo, r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.activo = TRUE`,
      [req.usuario.id]
    );

    if (filas.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario no disponible' });
    }

    res.json(filas[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { login, perfil };