const pool = require('../config/db');

// Error con código HTTP para reglas de negocio (stock insuficiente, producto inexistente...)
class ErrorNegocio extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

// Ejecuta un bloque dentro de una transacción: si algo falla, se deshace todo
async function enTransaccion(callback) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await callback(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

const redondear = (n) => Math.round(n * 100) / 100;

// Cambia el stock de un producto y deja el rastro en el kárdex.
// "cantidad" lleva signo: positiva suma, negativa resta.
// Debe llamarse dentro de enTransaccion.
async function registrarMovimiento(
  conexion,
  { idProducto, idUsuario, tipo, cantidad, idVenta = null, nota = null }
) {
  // FOR UPDATE bloquea la fila hasta que termine la transacción
  const [filas] = await conexion.query(
    'SELECT existencias FROM producto WHERE id_producto = ? FOR UPDATE',
    [idProducto]
  );
  if (filas.length === 0) {
    throw new ErrorNegocio('Producto no encontrado', 404);
  }

  const actuales = Number(filas[0].existencias);
  const nuevas = redondear(actuales + Number(cantidad));

  if (nuevas < 0) {
    throw new ErrorNegocio(
      `Stock insuficiente: hay ${actuales} y se intentó descontar ${Math.abs(cantidad)}`,
      409
    );
  }

  await conexion.query('UPDATE producto SET existencias = ? WHERE id_producto = ?', [
    nuevas,
    idProducto,
  ]);

  const [resultado] = await conexion.query(
    `INSERT INTO movimiento_inventario
      (id_producto, id_usuario, id_venta, tipo, cantidad, existencias_resultantes, nota)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idProducto, idUsuario, idVenta, tipo, cantidad, nuevas, nota]
  );

  return { id_movimiento: resultado.insertId, existencias_resultantes: nuevas };
}

module.exports = { ErrorNegocio, enTransaccion, registrarMovimiento };