const pool = require('../config/db');
const { ErrorNegocio, enTransaccion, registrarMovimiento } = require('../services/inventario.service');

const TIPOS = ['entrada', 'venta', 'anulacion', 'ajuste'];

function manejarError(error, res) {
  if (error instanceof ErrorNegocio) {
    return res.status(error.estado).json({ mensaje: error.message });
  }
  console.error(error);
  res.status(500).json({ mensaje: 'Error del servidor' });
}

// POST /api/movimientos/entrada  { id_producto, cantidad, nota? }
async function entrada(req, res) {
  const { id_producto, nota } = req.body;
  const cantidad = Number(req.body.cantidad);

  const errores = [];
  if (!id_producto) errores.push('El producto es obligatorio');
  if (!(cantidad > 0)) errores.push('La cantidad debe ser mayor a 0');
  if (nota && nota.length > 200) errores.push('La nota no puede superar los 200 caracteres');
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const resultado = await enTransaccion((conexion) =>
      registrarMovimiento(conexion, {
        idProducto: id_producto,
        idUsuario: req.usuario.id,
        tipo: 'entrada',
        cantidad,
        nota: nota?.trim() || null,
      })
    );
    res.status(201).json({ mensaje: 'Entrada registrada', ...resultado });
  } catch (error) {
    manejarError(error, res);
  }
}

// POST /api/movimientos/ajuste  { id_producto, cantidad (con signo), nota }
async function ajuste(req, res) {
  const { id_producto, nota } = req.body;
  const cantidad = Number(req.body.cantidad);

  const errores = [];
  if (!id_producto) errores.push('El producto es obligatorio');
  if (!cantidad) errores.push('La cantidad debe ser un número distinto de 0');
  if (!nota?.trim()) errores.push('La nota es obligatoria en los ajustes');
  if (nota && nota.length > 200) errores.push('La nota no puede superar los 200 caracteres');
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const resultado = await enTransaccion((conexion) =>
      registrarMovimiento(conexion, {
        idProducto: id_producto,
        idUsuario: req.usuario.id,
        tipo: 'ajuste',
        cantidad,
        nota: nota.trim(),
      })
    );
    res.status(201).json({ mensaje: 'Ajuste registrado', ...resultado });
  } catch (error) {
    manejarError(error, res);
  }
}

// GET /api/movimientos?producto=&tipo=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&pagina=1&limite=20
async function listar(req, res) {
  try {
    const { producto, tipo, desde, hasta } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 20, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const offset = (pagina - 1) * limite;

    const condiciones = [];
    const params = [];

    if (producto) {
      condiciones.push('m.id_producto = ?');
      params.push(producto);
    }
    if (tipo) {
      if (!TIPOS.includes(tipo)) {
        return res.status(400).json({ mensaje: `El tipo debe ser uno de: ${TIPOS.join(', ')}` });
      }
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

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM movimiento_inventario m ${where}`,
      params
    );
    const [filas] = await pool.query(
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

    res.json({ datos: filas, total, pagina, limite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { entrada, ajuste, listar };