const Cliente = require('../models/cliente.model');
const Producto = require('../models/producto.model');
const Venta = require('../models/venta.model');
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
        const cliente = await Cliente.estadoPorId(conexion, idCliente);
        if (!cliente || !cliente.activo) {
          throw new ErrorNegocio('El cliente no existe o está inactivo', 400);
        }
      } else {
        const generico = await Cliente.buscarGenerico(conexion);
        if (!generico) {
          throw new ErrorNegocio('Falta el cliente "Consumidor Final" en la base de datos', 500);
        }
        idCliente = generico.id_cliente;
      }

      // 2. Productos: el precio y el IVA salen de la base de datos
      const productos = await Producto.porIds(conexion, items.map((i) => i.id_producto));
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
      const siguiente = await Venta.siguienteNumero(conexion);

      // 5. Venta, detalle y descuento de stock
      const idVenta = await Venta.insertar(conexion, {
        idCliente,
        idUsuario: req.usuario.id,
        numero: siguiente,
        medioPago: medio_pago,
        subtotal,
        descuento,
        ivaTotal,
        total,
      });

      for (const item of items) {
        const p = mapa.get(item.id_producto);

        await Venta.insertarDetalle(conexion, {
          idVenta,
          idProducto: item.id_producto,
          cantidad: item.cantidad,
          precioUnitario: p.precio_venta,
          porcentajeIva: p.porcentaje_iva,
        });

        await registrarMovimiento(conexion, {
          idProducto: item.id_producto,
          idUsuario: req.usuario.id,
          idVenta,
          tipo: 'venta',
          cantidad: -item.cantidad,
          nota: `Venta #${siguiente}`,
        });
      }

      return {
        id_venta: idVenta,
        numero: siguiente,
        subtotal,
        descuento: valorDescuento,
        iva_total: ivaTotal,
        total,
        cambio: montoRecibido !== null ? redondear(montoRecibido - total) : null,
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

    const { datos, total } = await Venta.listar({
      // El vendedor solo ve sus propias ventas
      idUsuario: req.usuario.rol === 'Vendedor/Cajero' ? req.usuario.id : null,
      desde,
      hasta,
      estado,
      medioPago: MEDIOS_PAGO.includes(medio_pago) ? medio_pago : null,
      cliente,
      numero,
      limite,
      offset: (pagina - 1) * limite,
    });

    res.json({
      datos: datos.map((f) => ({ ...f, ticket: formatearTicket(f.numero, f.fecha_hora) })),
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
    const venta = await Venta.obtener(req.params.id);
    const esVendedor = req.usuario.rol === 'Vendedor/Cajero';
    if (!venta || (esVendedor && venta.id_usuario !== req.usuario.id)) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }

    const items = await Venta.items(venta.id_venta);

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
      const venta = await Venta.bloquear(conexion, req.params.id);
      if (!venta) throw new ErrorNegocio('Venta no encontrada', 404);
      if (venta.estado === 'anulada') throw new ErrorNegocio('La venta ya está anulada', 409);

      await Venta.marcarAnulada(conexion, { id: venta.id_venta, motivo, idUsuario: req.usuario.id });

      // Devuelve el stock de cada línea
      const lineas = await Venta.lineas(conexion, venta.id_venta);
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