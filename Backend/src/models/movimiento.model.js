const { bd } = require('./base');

async function insertar(conexion, { idProducto, idUsuario, idVenta = null, tipo, cantidad, existenciasResultantes, nota = null }) {
  const [r] = await bd(conexion).query(
    `INSERT INTO movimiento_inventario
      (id_producto, id_usuario, id_venta, tipo, cantidad, existencias_resultantes, nota)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idProducto, idUsuario, idVenta, tipo, cantidad, existenciasResultantes, nota]
  );
  return r.insertId;
}

async function listar({ producto, tipo, desde, hasta, limite, offset }) {
  const condiciones = [];
  const params = [];

  if (producto) {
    condiciones.push('m.id_producto = ?');
    params.push(producto);
  }
  if (tipo) {
    condiciones.push('m.tipo = ?');
    params.push(tipo);
  }
  if (desde) {
    condiciones.push('m.fecha_hora >= ?');
    params.push(desde);
  }
  if (hasta) {
    condiciones.push('m.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM movimiento_inventario m ${where}`, params);
  const [datos] = await bd().query(
    `SELECT m.id_movimiento, m.fecha_hora, m.tipo, m.cantidad, m.existencias_resultantes,
            m.nota, m.id_venta, p.id_producto, p.codigo, p.nombre AS producto,
            u.nombre_completo AS usuario
     FROM movimiento_inventario m
     JOIN producto p ON p.id_producto = m.id_producto
     JOIN usuario u ON u.id_usuario = m.id_usuario
     ${where}
     ORDER BY m.fecha_hora DESC, m.id_movimiento DESC
     LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
  return { datos, total };
}

module.exports = { insertar, listar };