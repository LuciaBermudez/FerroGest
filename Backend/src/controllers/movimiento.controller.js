const Movimiento = require('../models/movimiento.model');
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

    if (tipo && !TIPOS.includes(tipo)) {
      return res.status(400).json({ mensaje: `El tipo debe ser uno de: ${TIPOS.join(', ')}` });
    }

    const { datos, total } = await Movimiento.listar({
      producto, tipo, desde, hasta, limite, offset: (pagina - 1) * limite,
    });
    res.json({ datos, total, pagina, limite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { entrada, ajuste, listar };