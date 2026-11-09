const pool = require('../config/db');

// Inicio de cada periodo. Son fragmentos fijos de SQL: nunca se arman con texto del usuario
const DESDE = {
  hoy: 'CURDATE()',
  semana: 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)', // lunes de esta semana
  mes: "DATE_FORMAT(CURDATE(), '%Y-%m-01')",
};
const PERIODOS = Object.keys(DESDE);
const DOCUMENTO_GENERICO = '222222222222'; // Consumidor Final

const redondear = (n) => Math.round(n * 100) / 100;

function desde(periodo) {
  if (!DESDE[periodo]) throw new Error(`Periodo inválido: ${periodo}`);
  return DESDE[periodo];
}

// Si se indica un usuario, solo cuentan las ventas de ese usuario (dashboard del vendedor)
function soloDe(idUsuario) {
  return idUsuario ? { sql: ' AND v.id_usuario = ?', params: [idUsuario] } : { sql: '', params: [] };
}

// Tarjetas fijas: ventas de hoy y del mes
async function ventasFijas(idUsuario) {
  const f = soloDe(idUsuario);
  const [[fila]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN v.fecha_hora >= CURDATE() THEN v.total END), 0) AS ventas_hoy,
            COUNT(CASE WHEN v.fecha_hora >= CURDATE() THEN 1 END) AS num_ventas_hoy,
            COALESCE(SUM(v.total), 0) AS ventas_mes,
            COUNT(*) AS num_ventas_mes
     FROM venta v
     WHERE v.estado = 'activa' AND v.fecha_hora >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${f.sql}`,
    f.params
  );
  return fila;
}

// Total vendido, número de ventas, anuladas y ticket promedio del periodo
async function resumenPeriodo(periodo, idUsuario) {
  const f = soloDe(idUsuario);
  const [[fila]] = await pool.query(
    `SELECT COUNT(CASE WHEN v.estado = 'activa' THEN 1 END) AS num_ventas,
            COALESCE(SUM(CASE WHEN v.estado = 'activa' THEN v.total END), 0) AS total_vendido,
            COUNT(CASE WHEN v.estado = 'anulada' THEN 1 END) AS anuladas
     FROM venta v
     WHERE v.fecha_hora >= ${desde(periodo)}${f.sql}`,
    f.params
  );
  return {
    periodo,
    ...fila,
    ticket_promedio: fila.num_ventas > 0 ? redondear(fila.total_vendido / fila.num_ventas) : 0,
  };
}

// Efectivo vs digital (tarjeta + transferencia)
async function mediosDePago(periodo, idUsuario) {
  const f = soloDe(idUsuario);
  const [filas] = await pool.query(
    `SELECT v.medio_pago, COUNT(*) AS num_ventas, COALESCE(SUM(v.total), 0) AS total
     FROM venta v
     WHERE v.estado = 'activa' AND v.fecha_hora >= ${desde(periodo)}${f.sql}
     GROUP BY v.medio_pago`,
    f.params
  );

  const suma = (lista) => lista.reduce((acc, fila) => acc + fila.total, 0);
  const efectivo = suma(filas.filter((fila) => fila.medio_pago === 'efectivo'));
  const digital = suma(filas.filter((fila) => fila.medio_pago !== 'efectivo'));
  const total = efectivo + digital;
  const porcentajeEfectivo = total > 0 ? Math.round((efectivo / total) * 100) : 0;

  return {
    efectivo: redondear(efectivo),
    digital: redondear(digital),
    porcentaje_efectivo: porcentajeEfectivo,
    porcentaje_digital: total > 0 ? 100 - porcentajeEfectivo : 0,
    detalle: filas,
  };
}

// Top 5 por valor vendido (con descuento e IVA, igual que el total de la venta)
async function topProductos(periodo, idUsuario) {
  const f = soloDe(idUsuario);
  const [filas] = await pool.query(
    `SELECT p.id_producto, p.codigo, p.nombre, p.unidad_medida,
            SUM(d.cantidad) AS unidades,
            ROUND(SUM(d.cantidad * d.precio_unitario * (1 - v.porcentaje_descuento / 100)
                      * (1 + d.porcentaje_iva / 100)), 2) AS total
     FROM detalle_venta d
     JOIN venta v ON v.id_venta = d.id_venta
     JOIN producto p ON p.id_producto = d.id_producto
     WHERE v.estado = 'activa' AND v.fecha_hora >= ${desde(periodo)}${f.sql}
     GROUP BY p.id_producto, p.codigo, p.nombre, p.unidad_medida
     ORDER BY total DESC
     LIMIT 5`,
    f.params
  );
  return {
    total_generado: redondear(filas.reduce((acc, fila) => acc + fila.total, 0)),
    productos: filas,
  };
}

// Estado del stock: solo cuenta productos activos para "bajo" y "agotado"
async function resumenStock() {
  const [[fila]] = await pool.query(
    `SELECT COUNT(*) AS referencias,
            COUNT(CASE WHEN activo = TRUE THEN 1 END) AS activos,
            COUNT(CASE WHEN activo = FALSE THEN 1 END) AS desactivados,
            COUNT(CASE WHEN activo = TRUE AND existencias > 0 AND existencias <= stock_minimo THEN 1 END) AS bajo,
            COUNT(CASE WHEN activo = TRUE AND existencias <= 0 THEN 1 END) AS agotado
     FROM producto`
  );
  return { ...fila, total: fila.bajo + fila.agotado };
}

// Los productos que más urgen reponer (usa la vista v_productos_stock_bajo)
async function productosCriticos(limite = 8) {
  const [filas] = await pool.query(
    `SELECT codigo, nombre, categoria, existencias, stock_minimo, nivel
     FROM v_productos_stock_bajo
     ORDER BY existencias ASC, nombre
     LIMIT ?`,
    [limite]
  );
  return filas;
}

// Entradas de mercancía registradas en el periodo
async function entradasPeriodo(periodo) {
  const [[fila]] = await pool.query(
    `SELECT COUNT(*) AS movimientos, COALESCE(SUM(cantidad), 0) AS unidades
     FROM movimiento_inventario
     WHERE tipo = 'entrada' AND fecha_hora >= ${desde(periodo)}`
  );
  return fila;
}

async function ultimosMovimientos(limite = 10) {
  const [filas] = await pool.query(
    `SELECT m.id_movimiento, m.fecha_hora, m.tipo, m.cantidad, m.existencias_resultantes,
            p.codigo, p.nombre AS producto, u.nombre_completo AS usuario
     FROM movimiento_inventario m
     JOIN producto p ON p.id_producto = m.id_producto
     JOIN usuario u ON u.id_usuario = m.id_usuario
     ORDER BY m.fecha_hora DESC, m.id_movimiento DESC
     LIMIT ?`,
    [limite]
  );
  return filas;
}

async function clientesPorTipo() {
  const [filas] = await pool.query(
    `SELECT tipo, COUNT(*) AS cantidad
     FROM cliente
     WHERE activo = TRUE AND documento <> ?
     GROUP BY tipo`,
    [DOCUMENTO_GENERICO]
  );
  const cantidad = (tipo) => filas.find((fila) => fila.tipo === tipo)?.cantidad || 0;
  return { personas_naturales: cantidad('persona_natural'), empresas: cantidad('empresa') };
}

module.exports = {
  PERIODOS,
  ventasFijas,
  resumenPeriodo,
  mediosDePago,
  topProductos,
  resumenStock,
  productosCriticos,
  entradasPeriodo,
  ultimosMovimientos,
  clientesPorTipo,
};