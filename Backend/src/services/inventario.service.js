const pool = require('../config/db');
const Producto = require('../models/producto.model');
const Movimiento = require('../models/movimiento.model');

// Error con código HTTP para reglas de negocio (stock insuficiente, producto inexistente...)
class ErrorNegocio extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

// Solo administra la transacción (abrir, confirmar o deshacer): si algo falla, se deshace todo
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
  const existencias = await Producto.bloquearExistencias(conexion, idProducto);
  if (existencias === null) {
    throw new ErrorNegocio('Producto no encontrado', 404);
  }

  const actuales = Number(existencias);
  const nuevas = redondear(actuales + Number(cantidad));

  if (nuevas < 0) {
    throw new ErrorNegocio(
      `Stock insuficiente: hay ${actuales} y se intentó descontar ${Math.abs(cantidad)}`,
      409
    );
  }

  await Producto.actualizarExistencias(conexion, idProducto, nuevas);

  const idMovimiento = await Movimiento.insertar(conexion, {
    idProducto, idUsuario, idVenta, tipo, cantidad, existenciasResultantes: nuevas, nota,
  });

  return { id_movimiento: idMovimiento, existencias_resultantes: nuevas };
}

module.exports = { ErrorNegocio, enTransaccion, registrarMovimiento };