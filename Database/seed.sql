
USE ferrogest;

INSERT INTO rol (nombre, descripcion) VALUES
('Administrador', 'Gestiona usuarios, productos, categorías e inventario'),
('Vendedor', 'Registra ventas y consulta productos'),
('Almacenista', 'Gestiona productos y movimientos de inventario')
ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion);

INSERT INTO categoria (nombre, descripcion) VALUES
('Herramientas manuales', 'Herramientas de uso manual'),
('Materiales de construcción', 'Materiales para construcción y reparación'),
('Tornillería y fijaciones', 'Tornillos, tuercas, pernos y fijaciones'),
('Pinturas y acabados', 'Pinturas, brochas y productos de acabado')
ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion);

INSERT INTO producto (
    id_categoria,
    codigo,
    nombre,
    descripcion,
    precio_compra,
    precio_venta,
    stock_actual,
    stock_minimo,
    unidad_medida
)
SELECT
    id_categoria,
    'FER-PRUEBA-001',
    'Martillo de prueba',
    'Producto de prueba para verificar la base de datos',
    15000.00,
    22000.00,
    10.000,
    2.000,
    'unidad'
FROM categoria
WHERE nombre = 'Herramientas manuales'
ON DUPLICATE KEY UPDATE
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion);
