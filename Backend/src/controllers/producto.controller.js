const Producto = require('../models/producto.model');
const Movimiento = require('../models/movimiento.model');
const { enTransaccion } = require('../services/inventario.service');

// Ajusta lo que se devuelve según el rol: el costo de compra es solo del administrador
function prepararProducto(producto, rol) {
  if (rol !== 'Administrador') delete producto.precio_compra;
  producto.activo = Boolean(producto.activo);
  return producto;
}

function validar(d) {
  const errores = [];
  if (!d.codigo?.trim()) errores.push('El código es obligatorio');
  if (!d.nombre?.trim()) errores.push('El nombre es obligatorio');
  if (!d.unidad_medida?.trim()) errores.push('La unidad de medida es obligatoria');
  if (!d.id_categoria) errores.push('La categoría es obligatoria');
  if (!(Number(d.precio_venta) >= 0)) errores.push('El precio de venta debe ser un número mayor o igual a 0');
  if (d.precio_compra !== undefined && !(Number(d.precio_compra) >= 0)) {
    errores.push('El precio de compra debe ser un número mayor o igual a 0');
  }
  const iva = Number(d.porcentaje_iva);
  if (d.porcentaje_iva === undefined || !(iva >= 0 && iva <= 100)) {
    errores.push('El IVA debe estar entre 0 y 100');
  }
  if (d.stock_minimo !== undefined && !(Number(d.stock_minimo) >= 0)) {
    errores.push('El stock mínimo debe ser mayor o igual a 0');
  }
  if (d.codigo && d.codigo.trim().length > 30) errores.push('El código no puede superar los 30 caracteres');
  if (d.nombre && d.nombre.trim().length > 100) errores.push('El nombre no puede superar los 100 caracteres');
  if (d.descripcion && d.descripcion.trim().length > 255) errores.push('La descripción no puede superar los 255 caracteres');
  if (d.unidad_medida && d.unidad_medida.trim().length > 20) errores.push('La unidad de medida no puede superar los 20 caracteres');
  return errores;
}

// Datos del cuerpo de la petición con el formato que esperan los modelos
function aDatosModelo(d, precioCompra) {
  return {
    idCategoria: d.id_categoria,
    codigo: d.codigo.trim(),
    nombre: d.nombre.trim(),
    descripcion: d.descripcion?.trim() || null,
    unidadMedida: d.unidad_medida.trim(),
    precioCompra,
    precioVenta: Number(d.precio_venta),
    porcentajeIva: Number(d.porcentaje_iva),
    stockMinimo: Number(d.stock_minimo) || 0,
  };
}

function errorDeBD(error, res) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ mensaje: 'Ya existe un producto con ese código' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ mensaje: 'La categoría indicada no existe' });
  }
  console.error(error);
  res.status(500).json({ mensaje: 'Error del servidor' });
}

// GET /api/productos?buscar=&categoria=&estado=normal|bajo&activo=true|false&pagina=1&limite=10
async function listar(req, res) {
  try {
    const { buscar, categoria, estado, activo } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 10, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);

    const { datos, total } = await Producto.listar({
      buscar, categoria, estado, activo, limite, offset: (pagina - 1) * limite,
    });

    res.json({
      datos: datos.map((f) => prepararProducto(f, req.usuario.rol)),
      total,
      pagina,
      limite,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function obtener(req, res) {
  try {
    const producto = await Producto.obtener(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json(prepararProducto(producto, req.usuario.rol));
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function crear(req, res) {
  const d = req.body;
  const errores = validar(d);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  const precioCompra = req.usuario.rol === 'Administrador' ? Number(d.precio_compra) || 0 : 0;
  const stockInicial = Number(d.existencias) || 0;
  if (stockInicial < 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores: ['El stock inicial no puede ser negativo'] });
  }

  try {
    const idProducto = await enTransaccion(async (conexion) => {
      const id = await Producto.crear(conexion, { ...aDatosModelo(d, precioCompra), existencias: stockInicial });

      // El stock inicial queda registrado en el kárdex
      if (stockInicial > 0) {
        await Movimiento.insertar(conexion, {
          idProducto: id,
          idUsuario: req.usuario.id,
          tipo: 'entrada',
          cantidad: stockInicial,
          existenciasResultantes: stockInicial,
          nota: 'Inventario inicial',
        });
      }
      return id;
    });

    res.status(201).json({ id_producto: idProducto, mensaje: 'Producto creado' });
  } catch (error) {
    errorDeBD(error, res);
  }
}

// PUT: el stock NO se modifica aquí, solo con movimientos de inventario
async function actualizar(req, res) {
  const d = req.body;
  const errores = validar(d);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  // Solo el administrador puede cambiar el costo de compra
  const esAdmin = req.usuario.rol === 'Administrador';
  const incluirCompra = esAdmin && d.precio_compra !== undefined;

  try {
    const filas = await Producto.actualizar(
      req.params.id,
      aDatosModelo(d, Number(d.precio_compra) || 0),
      { incluirCompra }
    );
    if (filas === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    errorDeBD(error, res);
  }
}

// PATCH /api/productos/:id/estado  { "activo": true | false }
async function cambiarEstado(req, res) {
  if (typeof req.body.activo !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo "activo" debe ser true o false' });
  }

  try {
    const filas = await Producto.cambiarEstado(req.params.id, req.body.activo);
    if (filas === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json({ mensaje: req.body.activo ? 'Producto activado' : 'Producto desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };