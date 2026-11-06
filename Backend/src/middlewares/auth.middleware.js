const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Exige un token válido y un usuario que siga activo en la base de datos
async function verificarToken(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }

  try {
    // Se consulta en cada petición: si desactivan al usuario o le cambian el rol, aplica de inmediato
    const [filas] = await pool.query(
      `SELECT u.id_usuario, u.activo, r.nombre AS rol
       FROM usuario u
       JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ?`,
      [payload.id]
    );

    if (filas.length === 0 || !filas[0].activo) {
      return res.status(401).json({ mensaje: 'Usuario no disponible' });
    }

    req.usuario = { id: filas[0].id_usuario, rol: filas[0].rol };
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// Limita una ruta a ciertos roles. Se usa después de verificarToken
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };