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

// Tarjetas fijas: ventas de hoy y del mes
async function ventasFijas() {
  const [[fila]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN fecha_hora >= CURDATE() THEN total END), 0) AS ventas_hoy,
            COUNT(CASE WHEN fecha_hora >= CURDATE() THEN 1 END) AS num_ventas_hoy,
            COALESCE(SUM(total), 0) AS ventas_mes,
            COUNT(*) AS num_ventas_mes
     FROM venta
     WHERE estado = 'activa' AND fecha_hora >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
  );
  return fila;
}

// Total vendido, número de ventas, anuladas y ticket promedio del periodo
async function resumenPeriodo(periodo) {
  const [[fila]] = await pool.query(
    `SELECT COUNT(CASE WHEN estado = 'activa' THEN 1 END) AS num_ventas,
            COALESCE(SUM(CASE WHEN estado = 'activa' THEN total END), 0) AS total_vendido,
            COUNT(CASE WHEN estado = 'anulada' THEN 1 END) AS anuladas
     FROM venta
     WHERE fecha_hora >= ${desde(periodo)}`
  );
  return {
    periodo,
    ...fila,
    ticket_promedio: fila.num_ventas > 0 ? redondear(fila.total_vendido / fila.num_ventas) : 0,
  };
}

// Efectivo vs digital (tarjeta + transferencia)
async function mediosDePago(periodo) {
  const [filas] = await pool.query(
    `SELECT medio_pago, COUNT(*) AS num_ventas, COALESCE(SUM(total), 0) AS total
     FROM venta
     WHERE estado = 'activa' AND fecha_hora >= ${desde(periodo)}
     GROUP BY medio_pago`
  );

  const suma = (lista) => lista.reduce((acc, f) => acc + f.total, 0);
  const efectivo = suma(filas.filter((f) => f.medio_pago === 'efectivo'));
  const digital = suma(filas.filter((f) => f.medio_pago !== 'efectivo'));
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
async function topProductos(periodo) {
  const [filas] = await pool.query(
    `SELECT p.id_producto, p.codigo, p.nombre, p.unidad_medida,
            SUM(d.cantidad) AS unidades,
            ROUND(SUM(d.cantidad * d.precio_unitario * (1 - v.porcentaje_descuento / 100)
                      * (1 + d.porcentaje_iva / 100)), 2) AS total
     FROM detalle_venta d
     JOIN venta v ON v.id_venta = d.id_venta
     JOIN producto p ON p.id_producto = d.id_producto
     WHERE v.estado = 'activa' AND v.fecha_hora >= ${desde(periodo)}
     GROUP BY p.id_producto, p.codigo, p.nombre, p.unidad_medida
     ORDER BY total DESC
     LIMIT 5`
  );
  return {
    total_generado: redondear(filas.reduce((acc, f) => acc + f.total, 0)),
    productos: filas,
  };
}

// Usa la vista v_productos_stock_bajo del script SQL
async function stockBajo() {
  const [filas] = await pool.query(
    'SELECT nivel, COUNT(*) AS cantidad FROM v_productos_stock_bajo GROUP BY nivel'
  );
  const cantidad = (nivel) => filas.find((f) => f.nivel === nivel)?.cantidad || 0;
  const bajo = cantidad('bajo');
  const agotado = cantidad('agotado');
  return { bajo, agotado, total: bajo + agotado };
}

async function clientesPorTipo() {
  const [filas] = await pool.query(
    `SELECT tipo, COUNT(*) AS cantidad
     FROM cliente
     WHERE activo = TRUE AND documento <> ?
     GROUP BY tipo`,
    [DOCUMENTO_GENERICO]
  );
  const cantidad = (tipo) => filas.find((f) => f.tipo === tipo)?.cantidad || 0;
  return { personas_naturales: cantidad('persona_natural'), empresas: cantidad('empresa') };
}

module.exports = {
  PERIODOS,
  ventasFijas,
  resumenPeriodo,
  mediosDePago,
  topProductos,
  stockBajo,
  clientesPorTipo,
};