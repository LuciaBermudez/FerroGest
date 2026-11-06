const reportes = require('../services/reportes.service');

// GET /api/dashboard?periodo=hoy|semana|mes
async function obtener(req, res) {
  const periodo = req.query.periodo || 'hoy';
  if (!reportes.PERIODOS.includes(periodo)) {
    return res.status(400).json({ mensaje: `El periodo debe ser uno de: ${reportes.PERIODOS.join(', ')}` });
  }

  try {
    const [fijas, resumen, medios, top, stock, clientes] = await Promise.all([
      reportes.ventasFijas(),
      reportes.resumenPeriodo(periodo),
      reportes.mediosDePago(periodo),
      reportes.topProductos(periodo),
      reportes.stockBajo(),
      reportes.clientesPorTipo(),
    ]);

    res.json({
      periodo,
      ventas_hoy: { total: fijas.ventas_hoy, num_ventas: fijas.num_ventas_hoy },
      ventas_mes: { total: fijas.ventas_mes, num_ventas: fijas.num_ventas_mes },
      stock,
      clientes,
      resumen,
      medios_pago: medios,
      top_productos: top,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { obtener };