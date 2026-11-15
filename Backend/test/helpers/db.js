const bcrypt = require('bcryptjs');
const pool = require('../../src/config/db');

const CLAVE = 'Clave1234';

const USUARIOS = {
  admin: { id: 1, correo: 'admin@test.local', clave: CLAVE, rol: 'Administrador' },
  vendedor: { id: 2, correo: 'vendedor@test.local', clave: CLAVE, rol: 'Vendedor/Cajero' },
  vendedor2: { id: 3, correo: 'vendedor2@test.local', clave: CLAVE, rol: 'Vendedor/Cajero' },
  encargado: { id: 4, correo: 'encargado@test.local', clave: CLAVE, rol: 'Encargado del Inventario' },
  inactivo: { id: 5, correo: 'inactivo@test.local', clave: CLAVE, rol: 'Vendedor/Cajero' },
};

const PRODUCTOS = {
  taladro: { id: 1, codigo: 'TAL-001', nombre: 'Taladro de prueba', precio: 100000, iva: 19, stock: 10, minimo: 2 },
  cemento: { id: 2, codigo: 'CEM-001', nombre: 'Cemento de prueba', precio: 25000, iva: 5, stock: 3, minimo: 5 },
  pintura: { id: 3, codigo: 'PIN-001', nombre: 'Pintura agotada', precio: 15000, iva: 0, stock: 0, minimo: 1 },
  inactivo: { id: 4, codigo: 'INA-001', nombre: 'Producto inactivo', precio: 2000, iva: 19, stock: 5, minimo: 0 },
};

const CLIENTES = {
  generico: { id: 1, documento: '222222222222' },
  natural: { id: 2, documento: '1020458912' },
  empresa: { id: 3, documento: '900548120-3' },
};

async function resetDatabase() {
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    const tablas = [
      'movimiento_inventario', 'detalle_venta', 'venta', 'secuencia_ticket', 'token_recuperacion',
      'producto', 'cliente', 'usuario', 'categoria', 'rol',
    ];
    for (const tabla of tablas) {
      await conexion.query(`TRUNCATE TABLE \`${tabla}\``);
    }
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');

    await conexion.query('INSERT INTO secuencia_ticket (id, ultimo) VALUES (1, 0)');

    await conexion.query(
      'INSERT INTO rol (id_rol, nombre) VALUES (1, ?), (2, ?), (3, ?)',
      ['Administrador', 'Vendedor/Cajero', 'Encargado del Inventario']
    );

    await conexion.query(
      `INSERT INTO categoria (id_categoria, nombre) VALUES
       (1, 'Herramientas Eléctricas'), (2, 'Obra Gris'), (3, 'Pinturas')`
    );

    const hash = bcrypt.hashSync(CLAVE, 4);
    await conexion.query(
      `INSERT INTO usuario (id_usuario, id_rol, nombre_completo, correo, contrasena_hash, activo) VALUES
       (?, 1, 'Admin de Pruebas', ?, ?, TRUE),
       (?, 2, 'Vendedor Uno', ?, ?, TRUE),
       (?, 2, 'Vendedor Dos', ?, ?, TRUE),
       (?, 3, 'Encargado de Pruebas', ?, ?, TRUE),
       (?, 2, 'Usuario Inactivo', ?, ?, FALSE)`,
      [
        USUARIOS.admin.id, USUARIOS.admin.correo, hash,
        USUARIOS.vendedor.id, USUARIOS.vendedor.correo, hash,
        USUARIOS.vendedor2.id, USUARIOS.vendedor2.correo, hash,
        USUARIOS.encargado.id, USUARIOS.encargado.correo, hash,
        USUARIOS.inactivo.id, USUARIOS.inactivo.correo, hash,
      ]
    );

    await conexion.query(
      `INSERT INTO cliente (id_cliente, tipo, tipo_documento, nombre_razon_social, documento, correo, direccion) VALUES
       (1, 'persona_natural', 'CC', 'Consumidor Final', '222222222222', NULL, NULL),
       (2, 'persona_natural', 'CC', 'Ana Pérez', '1020458912', 'ana@test.local', 'Calle 1 # 2-3'),
       (3, 'empresa', 'NIT', 'Constructora Andina S.A.S.', '900548120-3', 'compras@andina.test', 'Carrera 4 # 5-6')`
    );

    await conexion.query(
      `INSERT INTO producto
        (id_producto, id_categoria, codigo, nombre, descripcion, unidad_medida,
         precio_compra, precio_venta, porcentaje_iva, stock_minimo, existencias, activo) VALUES
       (1, 1, 'TAL-001', 'Taladro de prueba', 'Equipo de prueba', 'unid', 70000, 100000, 19, 2, 10, TRUE),
       (2, 2, 'CEM-001', 'Cemento de prueba', 'Bulto de prueba', 'bultos', 20000, 25000, 5, 5, 3, TRUE),
       (3, 3, 'PIN-001', 'Pintura agotada', 'Sin existencias', 'unid', 10000, 15000, 0, 1, 0, TRUE),
       (4, 1, 'INA-001', 'Producto inactivo', 'No se puede vender', 'unid', 1000, 2000, 19, 0, 5, FALSE)`
    );
  } finally {
    conexion.release();
  }
}

module.exports = { resetDatabase, pool, USUARIOS, PRODUCTOS, CLIENTES, CLAVE };
