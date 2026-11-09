const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');

async function login(req, res) {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);

    // Mismo mensaje si el usuario no existe, está inactivo o la contraseña falla:
    // así no se revela qué correos están registrados
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
    const usuario = await Usuario.buscarActivoPorId(req.usuario.id);

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Usuario no disponible' });
    }

    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { login, perfil };