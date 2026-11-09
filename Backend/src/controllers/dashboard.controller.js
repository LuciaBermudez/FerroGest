const reportes = require('../models/reporte.model');

const ROLES = {
  ADMIN: 'Administrador',
  VENDEDOR: 'Vendedor/Cajero',
  ENCARGADO: 'Encargado del Inventario',
};

async function datosAdmin(periodo) {
  const [fijas, resumen, medios, top, stock, clientes] = await Promise.all([
    reportes.ventasFijas(),
    reportes.resumenPeriodo(periodo),
    reportes.mediosDePago(periodo),
    reportes.topProductos(periodo),
    reportes.resumenStock(),
    reportes.clientesPorTipo(),
  ]);

  return {
    ventas_hoy: { total: fijas.ventas_hoy, num_ventas: fijas.num_ventas_hoy },
    ventas_mes: { total: fijas.ventas_mes, num_ventas: fijas.num_ventas_mes },
    stock,
    clientes,
    resumen,
    medios_pago: medios,
    top_productos: top,
  };
}

// El vendedor solo recibe SUS ventas; no recibe clientes ni cifras de otros usuarios
async function datosVendedor(periodo, idUsuario) {
  const [fijas, resumen, medios, top, stock] = await Promise.all([
    reportes.ventasFijas(idUsuario),
    reportes.resumenPeriodo(periodo, idUsuario),
    reportes.mediosDePago(periodo, idUsuario),
    reportes.topProductos(periodo, idUsuario),
    reportes.resumenStock(),
  ]);

  return {
    ventas_hoy: { total: fijas.ventas_hoy, num_ventas: fijas.num_ventas_hoy },
    ventas_mes: { total: fijas.ventas_mes, num_ventas: fijas.num_ventas_mes },
    stock: { bajo: stock.bajo, agotado: stock.agotado, total: stock.total },
    resumen,
    medios_pago: medios,
    top_productos: top,
  };
}

// El encargado recibe inventario y movimientos, y ninguna cifra de dinero
async function datosEncargado(periodo) {
  const [stock, criticos, entradas, movimientos] = await Promise.all([
    reportes.resumenStock(),
    reportes.productosCriticos(8),
    reportes.entradasPeriodo(periodo),
    reportes.ultimosMovimientos(10),
  ]);

  return { stock, criticos, entradas, ultimos_movimientos: movimientos };
}

const CONSTRUCTORES = {
  [ROLES.ADMIN]: (periodo) => datosAdmin(periodo),
  [ROLES.VENDEDOR]: (periodo, usuario) => datosVendedor(periodo, usuario.id),
  [ROLES.ENCARGADO]: (periodo) => datosEncargado(periodo),
};

// GET /api/dashboard?periodo=hoy|semana|mes
async function obtener(req, res) {
  const periodo = req.query.periodo || 'hoy';
  if (!reportes.PERIODOS.includes(periodo)) {
    return res.status(400).json({ mensaje: `El periodo debe ser uno de: ${reportes.PERIODOS.join(', ')}` });
  }

  const construir = CONSTRUCTORES[req.usuario.rol];
  if (!construir) {
    return res.status(403).json({ mensaje: 'Tu rol no tiene dashboard' });
  }

  try {
    const datos = await construir(periodo, req.usuario);
    res.json({ rol: req.usuario.rol, periodo, ...datos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { obtener };