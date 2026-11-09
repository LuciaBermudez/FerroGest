const { bd } = require('./base');

const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.unidad_medida,
         p.precio_compra, p.precio_venta, p.porcentaje_iva, p.stock_minimo,
         p.existencias, p.activo, p.id_categoria, c.nombre AS categoria
  FROM producto p
  JOIN categoria c ON c.id_categoria = p.id_categoria`;

async function listar({ buscar, categoria, estado, activo, limite, offset }) {
  const condiciones = [];
  const params = [];

  if (buscar) {
    condiciones.push('(p.codigo LIKE ? OR p.nombre LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`);
  }
  if (categoria) {
    condiciones.push('p.id_categoria = ?');
    params.push(categoria);
  }
  if (estado === 'bajo') condiciones.push('p.existencias <= p.stock_minimo');
  if (estado === 'normal') condiciones.push('p.existencias > p.stock_minimo');
  if (activo === 'true' || activo === 'false') {
    condiciones.push('p.activo = ?');
    params.push(activo === 'true');
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM producto p ${where}`, params);
  const [datos] = await bd().query(
    `${SELECT_PRODUCTO} ${where} ORDER BY p.nombre LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
  return { datos, total };
}

async function obtener(id) {
  const [filas] = await bd().query(`${SELECT_PRODUCTO} WHERE p.id_producto = ?`, [id]);
  return filas[0];
}

async function crear(conexion, d) {
  const [r] = await bd(conexion).query(
    `INSERT INTO producto
      (id_categoria, codigo, nombre, descripcion, unidad_medida,
       precio_compra, precio_venta, porcentaje_iva, stock_minimo, existencias)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.idCategoria, d.codigo, d.nombre, d.descripcion, d.unidadMedida,
      d.precioCompra, d.precioVenta, d.porcentajeIva, d.stockMinimo, d.existencias]
  );
  return r.insertId;
}

// El stock no se toca aquí: solo cambia con movimientos de inventario
async function actualizar(id, d, { incluirCompra }) {
  const sets = [
    'codigo = ?', 'nombre = ?', 'descripcion = ?', 'unidad_medida = ?',
    'id_categoria = ?', 'precio_venta = ?', 'porcentaje_iva = ?', 'stock_minimo = ?',
  ];
  const valores = [
    d.codigo, d.nombre, d.descripcion, d.unidadMedida,
    d.idCategoria, d.precioVenta, d.porcentajeIva, d.stockMinimo,
  ];

  if (incluirCompra) {
    sets.push('precio_compra = ?');
    valores.push(d.precioCompra);
  }

  const [r] = await bd().query(`UPDATE producto SET ${sets.join(', ')} WHERE id_producto = ?`, [...valores, id]);
  return r.affectedRows;
}

async function cambiarEstado(id, activo) {
  const [r] = await bd().query('UPDATE producto SET activo = ? WHERE id_producto = ?', [activo, id]);
  return r.affectedRows;
}

// Para el asistente de IA: nunca incluye precio_compra
async function buscarPorTexto(texto, limite = 5) {
  const patron = `%${texto}%`;
  const [filas] = await bd().query(
    `SELECT p.codigo, p.nombre, p.descripcion, c.nombre AS categoria, p.unidad_medida,
            p.existencias, p.stock_minimo, p.precio_venta, p.porcentaje_iva, p.activo
     FROM producto p
     JOIN categoria c ON c.id_categoria = p.id_categoria
     WHERE p.codigo LIKE ? OR p.nombre LIKE ? OR p.descripcion LIKE ?
     ORDER BY p.activo DESC, p.nombre
     LIMIT ?`,
    [patron, patron, patron, limite]
  );
  return filas;
}

// Usa la vista v_productos_stock_bajo del script SQL
async function stockBajo({ soloAgotados = false, limite = 15 } = {}) {
  const where = soloAgotados ? "WHERE nivel = 'agotado'" : '';

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM v_productos_stock_bajo ${where}`);
  const [productos] = await bd().query(
    `SELECT codigo, nombre, categoria, existencias, stock_minimo, nivel
     FROM v_productos_stock_bajo ${where}
     ORDER BY existencias ASC
     LIMIT ?`,
    [limite]
  );
  return { total, mostrados: productos.length, productos };
}

// --- Usados por las ventas y los movimientos de inventario (dentro de una transacción) ---

async function porIds(conexion, ids) {
  const [filas] = await bd(conexion).query(
    'SELECT id_producto, nombre, precio_venta, porcentaje_iva, activo FROM producto WHERE id_producto IN (?)',
    [ids]
  );
  return filas;
}

// FOR UPDATE bloquea la fila hasta que termine la transacción. Devuelve null si no existe
async function bloquearExistencias(conexion, id) {
  const [filas] = await bd(conexion).query(
    'SELECT existencias FROM producto WHERE id_producto = ? FOR UPDATE',
    [id]
  );
  return filas.length > 0 ? filas[0].existencias : null;
}

async function actualizarExistencias(conexion, id, existencias) {
  await bd(conexion).query('UPDATE producto SET existencias = ? WHERE id_producto = ?', [existencias, id]);
}

module.exports = {
  listar, obtener, crear, actualizar, cambiarEstado, buscarPorTexto, stockBajo,
  porIds, bloquearExistencias, actualizarExistencias,
};