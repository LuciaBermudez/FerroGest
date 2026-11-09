const { bd } = require('./base');

// --- Registro de una venta (dentro de una transacción) ---

// FOR UPDATE evita que dos ventas simultáneas tomen el mismo consecutivo
async function siguienteNumero(conexion) {
  const [[{ siguiente }]] = await bd(conexion).query(
    'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM venta FOR UPDATE'
  );
  return siguiente;
}

async function insertar(conexion, v) {
  const [r] = await bd(conexion).query(
    `INSERT INTO venta
      (id_cliente, id_usuario, numero, medio_pago, subtotal, porcentaje_descuento, iva_total, total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.idCliente, v.idUsuario, v.numero, v.medioPago, v.subtotal, v.descuento, v.ivaTotal, v.total]
  );
  return r.insertId;
}

async function insertarDetalle(conexion, d) {
  await bd(conexion).query(
    `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, porcentaje_iva)
     VALUES (?, ?, ?, ?, ?)`,
    [d.idVenta, d.idProducto, d.cantidad, d.precioUnitario, d.porcentajeIva]
  );
}

// --- Consultas ---

async function listar({ idUsuario, desde, hasta, estado, medioPago, cliente, numero, limite, offset }) {
  const condiciones = [];
  const params = [];

  if (idUsuario) {
    condiciones.push('v.id_usuario = ?');
    params.push(idUsuario);
  }
  if (desde) {
    condiciones.push('v.fecha_hora >= ?');
    params.push(desde);
  }
  if (hasta) {
    condiciones.push('v.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }
  if (estado === 'activa' || estado === 'anulada') {
    condiciones.push('v.estado = ?');
    params.push(estado);
  }
  if (medioPago) {
    condiciones.push('v.medio_pago = ?');
    params.push(medioPago);
  }
  if (cliente) {
    condiciones.push('v.id_cliente = ?');
    params.push(cliente);
  }
  if (numero) {
    condiciones.push('v.numero = ?');
    params.push(numero);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM venta v ${where}`, params);
  const [datos] = await bd().query(
    `SELECT v.id_venta, v.numero, v.fecha_hora, v.medio_pago, v.total, v.estado,
            c.nombre_razon_social AS cliente, c.tipo_documento, c.documento,
            u.nombre_completo AS vendedor
     FROM venta v
     JOIN cliente c ON c.id_cliente = v.id_cliente
     JOIN usuario u ON u.id_usuario = v.id_usuario
     ${where}
     ORDER BY v.fecha_hora DESC, v.id_venta DESC
     LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
  return { datos, total };
}

async function obtener(id) {
  const [filas] = await bd().query(
    `SELECT v.id_venta, v.id_usuario, v.numero, v.fecha_hora, v.medio_pago, v.subtotal,
            v.porcentaje_descuento, v.iva_total, v.total, v.estado, v.motivo_anulacion,
            v.fecha_anulacion, c.nombre_razon_social AS cliente, c.tipo_documento, c.documento,
            c.direccion AS direccion_cliente,
            u.nombre_completo AS vendedor, r.nombre AS rol_vendedor, ua.nombre_completo AS anulada_por
     FROM venta v
     JOIN cliente c ON c.id_cliente = v.id_cliente
     JOIN usuario u ON u.id_usuario = v.id_usuario
     JOIN rol r ON r.id_rol = u.id_rol
     LEFT JOIN usuario ua ON ua.id_usuario = v.id_usuario_anulacion
     WHERE v.id_venta = ?`,
    [id]
  );
  return filas[0];
}

async function items(idVenta) {
  const [filas] = await bd().query(
    `SELECT d.id_producto, p.codigo, p.nombre, p.unidad_medida, d.cantidad,
            d.precio_unitario, d.porcentaje_iva,
            ROUND(d.cantidad * d.precio_unitario, 2) AS subtotal
     FROM detalle_venta d
     JOIN producto p ON p.id_producto = d.id_producto
     WHERE d.id_venta = ?
     ORDER BY d.id_detalle`,
    [idVenta]
  );
  return filas;
}

// --- Anulación (dentro de una transacción) ---

async function bloquear(conexion, id) {
  const [filas] = await bd(conexion).query(
    'SELECT id_venta, numero, estado FROM venta WHERE id_venta = ? FOR UPDATE',
    [id]
  );
  return filas[0];
}

async function marcarAnulada(conexion, { id, motivo, idUsuario }) {
  await bd(conexion).query(
    `UPDATE venta
     SET estado = 'anulada', motivo_anulacion = ?, id_usuario_anulacion = ?, fecha_anulacion = NOW()
     WHERE id_venta = ?`,
    [motivo, idUsuario, id]
  );
}

async function lineas(conexion, idVenta) {
  const [filas] = await bd(conexion).query(
    'SELECT id_producto, cantidad FROM detalle_venta WHERE id_venta = ? ORDER BY id_producto',
    [idVenta]
  );
  return filas;
}

// --- Historial de un cliente ---

async function resumenDeCliente(idCliente) {
  const [[fila]] = await bd().query(
    `SELECT COUNT(*) AS num_compras, COALESCE(SUM(total), 0) AS total_comprado
     FROM venta
     WHERE id_cliente = ? AND estado = 'activa'`,
    [idCliente]
  );
  return fila;
}

async function ultimasDeCliente(idCliente, limite = 10) {
  const [filas] = await bd().query(
    `SELECT id_venta, numero,
            CONCAT('TK-', YEAR(fecha_hora), '-', LPAD(numero, 5, '0')) AS ticket,
            fecha_hora, medio_pago, total, estado
     FROM venta
     WHERE id_cliente = ?
     ORDER BY fecha_hora DESC, id_venta DESC
     LIMIT ?`,
    [idCliente, limite]
  );
  return filas;
}

module.exports = {
  siguienteNumero, insertar, insertarDetalle, listar, obtener, items,
  bloquear, marcarAnulada, lineas, resumenDeCliente, ultimasDeCliente,
};