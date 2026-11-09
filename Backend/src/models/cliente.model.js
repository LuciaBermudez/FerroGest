const { bd } = require('./base');

const DOCUMENTO_GENERICO = '222222222222'; // Consumidor Final

const COLUMNAS = `id_cliente, tipo, tipo_documento, nombre_razon_social, documento,
                  telefono, correo, direccion, activo`;

async function listar({ buscar, tipo, activo, limite, offset }) {
  // "Consumidor Final" no se gestiona desde la lista
  const condiciones = ['documento <> ?'];
  const params = [DOCUMENTO_GENERICO];

  if (buscar) {
    condiciones.push('(nombre_razon_social LIKE ? OR documento LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`);
  }
  if (tipo) {
    condiciones.push('tipo = ?');
    params.push(tipo);
  }
  if (activo === 'true' || activo === 'false') {
    condiciones.push('activo = ?');
    params.push(activo === 'true');
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;

  const [[{ total }]] = await bd().query(`SELECT COUNT(*) AS total FROM cliente ${where}`, params);
  const [datos] = await bd().query(
    `SELECT ${COLUMNAS} FROM cliente ${where} ORDER BY nombre_razon_social LIMIT ? OFFSET ?`,
    [...params, limite, offset]
  );
  return { datos, total };
}

async function obtener(id) {
  const [filas] = await bd().query(`SELECT ${COLUMNAS} FROM cliente WHERE id_cliente = ?`, [id]);
  return filas[0];
}

// Devuelve undefined si el cliente no existe
async function documentoDe(id) {
  const [filas] = await bd().query('SELECT documento FROM cliente WHERE id_cliente = ?', [id]);
  return filas[0]?.documento;
}

async function crear(c) {
  const [r] = await bd().query(
    `INSERT INTO cliente (tipo, tipo_documento, nombre_razon_social, documento, telefono, correo, direccion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [c.tipo, c.tipo_documento, c.nombre_razon_social, c.documento, c.telefono, c.correo, c.direccion]
  );
  return r.insertId;
}

async function actualizar(id, c) {
  await bd().query(
    `UPDATE cliente
     SET tipo = ?, tipo_documento = ?, nombre_razon_social = ?, documento = ?,
         telefono = ?, correo = ?, direccion = ?
     WHERE id_cliente = ?`,
    [c.tipo, c.tipo_documento, c.nombre_razon_social, c.documento, c.telefono, c.correo, c.direccion, id]
  );
}

async function cambiarEstado(id, activo) {
  await bd().query('UPDATE cliente SET activo = ? WHERE id_cliente = ?', [activo, id]);
}

// --- Usados al registrar una venta (dentro de una transacción) ---

async function estadoPorId(conexion, id) {
  const [filas] = await bd(conexion).query('SELECT activo FROM cliente WHERE id_cliente = ?', [id]);
  return filas[0];
}

async function buscarGenerico(conexion) {
  const [filas] = await bd(conexion).query('SELECT id_cliente FROM cliente WHERE documento = ?', [DOCUMENTO_GENERICO]);
  return filas[0];
}

// Búsqueda por nombre o documento para el asistente de IA
async function buscarPorTexto(texto, limite = 4) {
  const patronNombre = `%${texto}%`;
  const patronDocumento = `%${texto.replace(/[.\s]/g, '')}%`; // los documentos se guardan sin puntos ni espacios
  const [filas] = await bd().query(
    `SELECT id_cliente, tipo, tipo_documento, nombre_razon_social, documento
     FROM cliente
     WHERE nombre_razon_social LIKE ? OR documento LIKE ?
     ORDER BY nombre_razon_social
     LIMIT ?`,
    [patronNombre, patronDocumento, limite]
  );
  return filas;
}

module.exports = {
  DOCUMENTO_GENERICO, listar, obtener, documentoDe, crear, actualizar, cambiarEstado,
  estadoPorId, buscarGenerico, buscarPorTexto,
};