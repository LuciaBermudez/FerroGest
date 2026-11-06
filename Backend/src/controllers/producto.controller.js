const pool = require('../config/db');

const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.unidad_medida,
         p.precio_compra, p.precio_venta, p.porcentaje_iva, p.stock_minimo,
         p.existencias, p.activo, p.id_categoria, c.nombre AS categoria
  FROM producto p
  JOIN categoria c ON c.id_categoria = p.id_categoria`;

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
  const iva = Number(d.porcentaje_iva);
  if (d.porcentaje_iva === undefined || !(iva >= 0 && iva <= 100)) {
    errores.push('El IVA debe estar entre 0 y 100');
  }
  if (d.stock_minimo !== undefined && !(Number(d.stock_minimo) >= 0)) {
    errores.push('El stock mínimo debe ser mayor o igual a 0');
  }
  return errores;
}

// GET /api/productos?buscar=&categoria=&estado=normal|bajo&activo=true|false&pagina=1&limite=10
async function listar(req, res) {
  try {
    const { buscar, categoria, estado, activo } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 10, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const offset = (pagina - 1) * limite;

    const condiciones = [];
    const params = [];

    if (buscar) {
      condiciones.push('(p.codigo LIKE ? OR p.nombre LIKE ?)');
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (categoria) {
      condiciones.push('p.id_categoria = ?');
      params.push(categoria);
    }
    if (estado === 'bajo') condiciones.push('p.existencias <= p.stock_minimo');
    if (estado === 'normal') condiciones.push('p.existencias > p.stock_minimo');
    if (activo === 'true' || activo === 'false') {
      condiciones.push('p.activo = ?');
      params.push(activo === 'true');
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM producto p ${where}`, params);
    const [filas] = await pool.query(
      `${SELECT_PRODUCTO} ${where} ORDER BY p.nombre LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );

    res.json({
      datos: filas.map((f) => prepararProducto(f, req.usuario.rol)),
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
    const [filas] = await pool.query(`${SELECT_PRODUCTO} WHERE p.id_producto = ?`, [req.params.id]);
    if (filas.length === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json(prepararProducto(filas[0], req.usuario.rol));
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

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [resultado] = await conexion.query(
      `INSERT INTO producto
        (id_categoria, codigo, nombre, descripcion, unidad_medida,
         precio_compra, precio_venta, porcentaje_iva, stock_minimo, existencias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id_categoria, d.codigo.trim(), d.nombre.trim(), d.descripcion?.trim() || null,
        d.unidad_medida.trim(), precioCompra, Number(d.precio_venta), Number(d.porcentaje_iva),
        Number(d.stock_minimo) || 0, stockInicial,
      ]
    );

    // El stock inicial queda registrado en el kárdex
    if (stockInicial > 0) {
      await conexion.query(
        `INSERT INTO movimiento_inventario
          (id_producto, id_usuario, tipo, cantidad, existencias_resultantes, nota)
         VALUES (?, ?, 'entrada', ?, ?, 'Inventario inicial')`,
        [resultado.insertId, req.usuario.id, stockInicial, stockInicial]
      );
    }

    await conexion.commit();
    res.status(201).json({ id_producto: resultado.insertId, mensaje: 'Producto creado' });
  } catch (error) {
    await conexion.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un producto con ese código' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ mensaje: 'La categoría indicada no existe' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  } finally {
    conexion.release();
  }
}

// PUT: el stock NO se modifica aquí, solo con movimientos de inventario
async function actualizar(req, res) {
  const d = req.body;
  const errores = validar(d);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  const sets = [
    'codigo = ?', 'nombre = ?', 'descripcion = ?', 'unidad_medida = ?',
    'id_categoria = ?', 'precio_venta = ?', 'porcentaje_iva = ?', 'stock_minimo = ?',
  ];
  const valores = [
    d.codigo.trim(), d.nombre.trim(), d.descripcion?.trim() || null, d.unidad_medida.trim(),
    d.id_categoria, Number(d.precio_venta), Number(d.porcentaje_iva), Number(d.stock_minimo) || 0,
  ];

  // Solo el administrador puede cambiar el costo de compra
  if (req.usuario.rol === 'Administrador' && d.precio_compra !== undefined) {
    sets.push('precio_compra = ?');
    valores.push(Number(d.precio_compra) || 0);
  }

  try {
    const [resultado] = await pool.query(
      `UPDATE producto SET ${sets.join(', ')} WHERE id_producto = ?`,
      [...valores, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un producto con ese código' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ mensaje: 'La categoría indicada no existe' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// PATCH /api/productos/:id/estado  { "activo": true | false }
async function cambiarEstado(req, res) {
  if (typeof req.body.activo !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo "activo" debe ser true o false' });
  }

  try {
    const [resultado] = await pool.query(
      'UPDATE producto SET activo = ? WHERE id_producto = ?',
      [req.body.activo, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json({ mensaje: req.body.activo ? 'Producto activado' : 'Producto desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };