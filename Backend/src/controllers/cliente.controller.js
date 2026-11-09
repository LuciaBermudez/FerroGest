const Cliente = require('../models/cliente.model');
const Venta = require('../models/venta.model');

const TIPOS = ['persona_natural', 'empresa'];
const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PASAPORTE'];
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizar(d) {
  return {
    tipo: d.tipo,
    tipo_documento: d.tipo_documento,
    nombre_razon_social: d.nombre_razon_social?.trim(),
    // Sin puntos ni espacios: "900.542.119-4" y "900542119-4" son el mismo cliente
    documento: d.documento?.toString().replace(/[.\s]/g, ''),
    telefono: d.telefono?.trim() || null,
    correo: d.correo?.trim().toLowerCase() || null,
    direccion: d.direccion?.trim() || null,
  };
}

function validar(c) {
  const errores = [];
  if (!TIPOS.includes(c.tipo)) errores.push(`El tipo debe ser uno de: ${TIPOS.join(', ')}`);
  if (!TIPOS_DOCUMENTO.includes(c.tipo_documento)) {
    errores.push(`El tipo de documento debe ser uno de: ${TIPOS_DOCUMENTO.join(', ')}`);
  }
  if (c.tipo === 'empresa' && c.tipo_documento !== 'NIT') errores.push('Una empresa se identifica con NIT');
  if (c.tipo === 'persona_natural' && c.tipo_documento === 'NIT') errores.push('Una persona natural no usa NIT');
  if (!c.nombre_razon_social) errores.push('El nombre o razón social es obligatorio');
  else if (c.nombre_razon_social.length > 100) errores.push('El nombre no puede superar los 100 caracteres');
  if (!c.documento || !/^[A-Za-z0-9-]{4,20}$/.test(c.documento)) {
    errores.push('El documento debe tener entre 4 y 20 caracteres (letras, números o guion)');
  }
  if (c.telefono && c.telefono.length > 20) errores.push('El teléfono no puede superar los 20 caracteres');
  if (c.correo && (c.correo.length > 100 || !REGEX_CORREO.test(c.correo))) errores.push('El correo no es válido');
  if (c.direccion && c.direccion.length > 150) errores.push('La dirección no puede superar los 150 caracteres');
  return errores;
}

// GET /api/clientes?buscar=&tipo=&activo=true|false&pagina=1&limite=10
async function listar(req, res) {
  try {
    const { buscar, tipo, activo } = req.query;
    const limite = Math.min(parseInt(req.query.limite) || 10, 100);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);

    const { datos, total } = await Cliente.listar({
      buscar,
      tipo: TIPOS.includes(tipo) ? tipo : null,
      activo,
      limite,
      offset: (pagina - 1) * limite,
    });

    res.json({
      datos: datos.map((f) => ({ ...f, activo: Boolean(f.activo) })),
      total,
      pagina,
      limite,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// GET /api/clientes/:id  (el administrador además recibe el historial de compras)
async function obtener(req, res) {
  try {
    const fila = await Cliente.obtener(req.params.id);
    if (!fila) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    const cliente = { ...fila, activo: Boolean(fila.activo) };

    if (req.usuario.rol === 'Administrador') {
      const resumen = await Venta.resumenDeCliente(cliente.id_cliente);
      cliente.num_compras = resumen.num_compras;
      cliente.total_comprado = resumen.total_comprado;
      cliente.compras = await Venta.ultimasDeCliente(cliente.id_cliente, 10);
    }

    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function crear(req, res) {
  const c = normalizar(req.body);
  const errores = validar(c);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const id = await Cliente.crear(c);
    res.status(201).json({ id_cliente: id, mensaje: 'Cliente creado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un cliente con ese documento' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function actualizar(req, res) {
  const c = normalizar(req.body);
  const errores = validar(c);
  if (errores.length > 0) {
    return res.status(400).json({ mensaje: 'Datos inválidos', errores });
  }

  try {
    const documentoActual = await Cliente.documentoDe(req.params.id);
    if (documentoActual === undefined) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }
    if (documentoActual === Cliente.DOCUMENTO_GENERICO) {
      return res.status(409).json({ mensaje: 'El cliente "Consumidor Final" no se puede modificar' });
    }

    await Cliente.actualizar(req.params.id, c);
    res.json({ mensaje: 'Cliente actualizado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un cliente con ese documento' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

// PATCH /api/clientes/:id/estado  { "activo": true | false }
async function cambiarEstado(req, res) {
  if (typeof req.body.activo !== 'boolean') {
    return res.status(400).json({ mensaje: 'El campo "activo" debe ser true o false' });
  }

  try {
    const documentoActual = await Cliente.documentoDe(req.params.id);
    if (documentoActual === undefined) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }
    if (documentoActual === Cliente.DOCUMENTO_GENERICO) {
      return res.status(409).json({ mensaje: 'El cliente "Consumidor Final" no se puede desactivar' });
    }

    await Cliente.cambiarEstado(req.params.id, req.body.activo);
    res.json({ mensaje: req.body.activo ? 'Cliente activado' : 'Cliente desactivado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };