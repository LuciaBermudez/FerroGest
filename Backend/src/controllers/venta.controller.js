const pool = require('../config/db');
const { ErrorNegocio, enTransaccion, registrarMovimiento } = require('../services/inventario.service');

const MEDIOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];
const redondear = (n) => Math.round(n * 100) / 100;

function manejarError(error, res) {
  if (error instanceof ErrorNegocio) {
    return res.status(error.estado).json({ mensaje: error.message });
  }
  console.error(error);
  res.status(500).json({ mensaje: 'Error del servidor' });
}

// Número de ticket legible, como TK-2026-00001
function formatearTicket(numero, fecha) {
  return `TK-${new Date(fecha).getFullYear()}-${String(numero).padStart(5, '0')}`;
}

function validarVenta(d) {
  const errores = [];

  if (!MEDIOS_PAGO.includes(d.medio_pago)) {
    errores.push(`El medio de pago debe ser uno de: ${MEDIOS_PAGO.join(', ')}`);
  }

  const descuento = d.porcentaje_descuento === undefined ? 0 : Number(d.porcentaje_descuento);
  if (!(descuento >= 0 && descuento <= 100)) {
    errores.push('El descuento debe estar entre 0 y 100');
  }

  if (d.monto_recibido !== undefined && !(Number(d.monto_recibido) >= 0)) {
    errores.push('El monto recibido debe ser un número válido');
  }

  if (!Array.isArray(d.items) || d.items.length === 0) {
    errores.push('La venta debe tener al menos un producto');
    return { errores, descuento };
  }

  // Une las líneas repetidas del mismo producto
  const porProducto = new Map();
  for (const item of d.items) {
    const id = Number(item.id_producto);
    const cantidad = Number(item.cantidad);
    if (!id || !(cantidad > 0)) {
      errores.push('Cada producto necesita id_producto y una cantidad mayor a 0');
      break;
    }
    porProducto.set(id, (porProducto.get(id) || 0) + cantidad);
  }

  // Ordenados por id: todas las ventas bloquean los productos en el mismo orden (evita deadlocks)
  const items = [...porProducto.entries()]
    .map(([id_producto, cantidad]) => ({ id_producto, cantidad }))
    .sort((a, b) => a.id_producto - b.id_producto);

  return { errores, items, descuento };
}

// POST /api/ventas
// { id_cliente?, medio_pago, porcentaje_descuento?, monto_recibido?, items: [{ id_producto, cantidad }] }
async function crear(req, res) {
  const { errores, items, descuento } = validarVenta(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  const { medio_pago, id_cliente } = req.body;
  const montoRecibido = req.body.monto_recibido === undefined ? null : Number(req.body.monto_recibido);

  try {
    const resultado = await enTransaccion(async (conexion) => {
      // 1. Cliente: si no se indica, se usa "Consumidor Final"
      let idCliente = id_cliente;
      if (idCliente) {
        const [clientes] = await conexion.query('SELECT activo FROM cliente WHERE id_cliente = ?', [idCliente]);
        if (clientes.length === 0 || !clientes[0].activo) {
          throw new ErrorNegocio('El cliente no existe o está inactivo', 400);
        }
      } else {
        const [generico] = await conexion.query(
          "SELECT id_cliente FROM cliente WHERE documento = '222222222222'"
        );
        if (generico.length === 0) {
          throw new ErrorNegocio('Falta el cliente "Consumidor Final" en la base de datos', 500);
        }
        idCliente = generico[0].id_cliente;
      }

      // 2. Productos: el precio y el IVA salen de la base de datos
      const [productos] = await conexion.query(
        'SELECT id_producto, nombre, precio_venta, porcentaje_iva, activo FROM producto WHERE id_producto IN (?)',
        [items.map((i) => i.id_producto)]
      );
      const mapa = new Map(productos.map((p) => [p.id_producto, p]));

      for (const item of items) {
        const p = mapa.get(item.id_producto);
        if (!p) throw new ErrorNegocio(`El producto ${item.id_producto} no existe`, 404);
        if (!p.activo) throw new ErrorNegocio(`El producto "${p.nombre}" está desactivado`, 409);
      }

      // 3. Totales
      const factor = 1 - descuento / 100;
      let subtotal = 0;
      let iva = 0;
      for (const item of items) {
        const p = mapa.get(item.id_producto);
        const base = Number(p.precio_venta) * item.cantidad;
        subtotal += base;
        iva += base * factor * (Number(p.porcentaje_iva) / 100);
      }
      subtotal = redondear(subtotal);
      const valorDescuento = redondear((subtotal * descuento) / 100);
      const ivaTotal = redondear(iva);
      const total = redondear(subtotal - valorDescuento + ivaTotal);

      if (montoRecibido !== null && montoRecibido < total) {
        throw new ErrorNegocio('El monto recibido es menor al total de la venta', 400);
      }

      // 4. Consecutivo del ticket
      const [[{ siguiente }]] = await conexion.query(
        'SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM venta FOR UPDATE'
      );

      // 5. Venta, detalle y descuento de stock
      const [venta] = await conexion.query(
        `INSERT INTO venta
          (id_cliente, id_usuario, numero, medio_pago, subtotal, porcentaje_descuento, iva_total, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [idCliente, req.usuario.id, siguiente, medio_pago, subtotal, descuento, ivaTotal, total]
      );

      for (const item of items) {
        const p = mapa.get(item.id_producto);

        await conexion.query(
          `INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, porcentaje_iva)
           VALUES (?, ?, ?, ?, ?)`,
          [venta.insertId, item.id_producto, item.cantidad, p.precio_venta, p.porcentaje_iva]
        );

        await registrarMovimiento(conexion, {
          idProducto: item.id_producto,
          idUsuario: req.usuario.id,
          idVenta: venta.insertId,
          tipo: 'venta',
          cantidad: -item.cantidad,
          nota: `Venta #${siguiente}`,
        });
      }

      return {
        id_venta: venta.insertId,
        numero: siguiente,
        subtotal,
        descuento: valorDescuento,
        iva_total: ivaTotal,
        total,
        cambio:
          montoRecibido !== null ? redondear(montoRecibido - total) : null,
      };
    });

    res.status(201).json({
      mensaje: 'Venta registrada',
      ticket: formatearTicket(resultado.numero, new Date()),
      ...resultado,
    });
  } catch (error) {
    manejarError(error, res);
  }
}

// GET /api/ventas?desde=&hasta=&estado=activa|anulada&medio_pago=&cliente=&numero=&pagina=1&limite=10
async function listar(req, res) {
  try {
    const { desde, hasta, estado, medio_pago, cliente, numero } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 10, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const offset = (pagina - 1) * limite;

    const condiciones = [];
    const params = [];

    // El vendedor solo ve sus propias ventas
    if (req.usuario.rol === 'Vendedor/Cajero') {
      condiciones.push('v.id_usuario = ?');
      params.push(req.usuario.id);
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
    if (MEDIOS_PAGO.includes(medio_pago)) {
      condiciones.push('v.medio_pago = ?');
      params.push(medio_pago);
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

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM venta v ${where}`, params);
    const [filas] = await pool.query(
      `SELECT v.id_venta, v.numero, v.fecha_hora, v.medio_pago, v.total, v.estado,
              c.nombre_razon_social AS cliente, c.documento,
              u.nombre_completo AS vendedor
       FROM venta v
       JOIN cliente c ON c.id_cliente = v.id_cliente
       JOIN usuario u ON u.id_usuario = v.id_usuario
       ${where}
       ORDER BY v.fecha_hora DESC, v.id_venta DESC
       LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    res.json({
      datos: filas.map((f) => ({ ...f, ticket: formatearTicket(f.numero, f.fecha_hora) })),
      total,
      pagina,
      limite,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// GET /api/ventas/:id  (detalle del ticket)
async function obtener(req, res) {
  try {
    const [ventas] = await pool.query(
      `SELECT v.id_venta, v.id_usuario, v.numero, v.fecha_hora, v.medio_pago, v.subtotal,
              v.porcentaje_descuento, v.iva_total, v.total, v.estado, v.motivo_anulacion,
              v.fecha_anulacion, c.nombre_razon_social AS cliente, c.tipo_documento, c.documento,
              u.nombre_completo AS vendedor, ua.nombre_completo AS anulada_por
       FROM venta v
       JOIN cliente c ON c.id_cliente = v.id_cliente
       JOIN usuario u ON u.id_usuario = v.id_usuario
       LEFT JOIN usuario ua ON ua.id_usuario = v.id_usuario_anulacion
       WHERE v.id_venta = ?`,
      [req.params.id]
    );

    const venta = ventas[0];
    const esVendedor = req.usuario.rol === 'Vendedor/Cajero';
    if (!venta || (esVendedor && venta.id_usuario !== req.usuario.id)) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }

    const [items] = await pool.query(
      `SELECT d.id_producto, p.codigo, p.nombre, p.unidad_medida, d.cantidad,
              d.precio_unitario, d.porcentaje_iva,
              ROUND(d.cantidad * d.precio_unitario, 2) AS subtotal
       FROM detalle_venta d
       JOIN producto p ON p.id_producto = d.id_producto
       WHERE d.id_venta = ?
       ORDER BY d.id_detalle`,
      [venta.id_venta]
    );

    delete venta.id_usuario;
    res.json({ ...venta, ticket: formatearTicket(venta.numero, venta.fecha_hora), items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// POST /api/ventas/:id/anular  { motivo }
async function anular(req, res) {
  const motivo = req.body.motivo?.trim();
  if (!motivo) {
    return res.status(400).json({ mensaje: 'El motivo de anulación es obligatorio' });
  }
  if (motivo.length > 200) {
    return res.status(400).json({ mensaje: 'El motivo no puede superar los 200 caracteres' });
  }

  try {
    await enTransaccion(async (conexion) => {
      const [ventas] = await conexion.query(
        'SELECT id_venta, numero, estado FROM venta WHERE id_venta = ? FOR UPDATE',
        [req.params.id]
      );
      if (ventas.length === 0) throw new ErrorNegocio('Venta no encontrada', 404);

      const venta = ventas[0];
      if (venta.estado === 'anulada') throw new ErrorNegocio('La venta ya está anulada', 409);

      await conexion.query(
        `UPDATE venta
         SET estado = 'anulada', motivo_anulacion = ?, id_usuario_anulacion = ?, fecha_anulacion = NOW()
         WHERE id_venta = ?`,
        [motivo, req.usuario.id, venta.id_venta]
      );

      // Devuelve el stock de cada línea
      const [lineas] = await conexion.query(
        'SELECT id_producto, cantidad FROM detalle_venta WHERE id_venta = ? ORDER BY id_producto',
        [venta.id_venta]
      );
      for (const linea of lineas) {
        await registrarMovimiento(conexion, {
          idProducto: linea.id_producto,
          idUsuario: req.usuario.id,
          idVenta: venta.id_venta,
          tipo: 'anulacion',
          cantidad: Number(linea.cantidad),
          nota: `Anulación de la venta #${venta.numero}`,
        });
      }
    });

    res.json({ mensaje: 'Venta anulada y stock devuelto' });
  } catch (error) {
    manejarError(error, res);
  }
}

module.exports = { crear, listar, obtener, anular };