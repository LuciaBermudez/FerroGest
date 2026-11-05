CREATE DATABASE IF NOT EXISTS ferrogest
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ferrogest;


CREATE TABLE rol (
  id_rol  INT AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuario (
  id_usuario       INT AUTO_INCREMENT PRIMARY KEY,
  id_rol           INT NOT NULL,
  nombre_completo  VARCHAR(100) NOT NULL,
  correo           VARCHAR(100) NOT NULL UNIQUE,
  contrasena_hash  VARCHAR(255) NOT NULL,  
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_usuario_rol
    FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE=InnoDB;

CREATE TABLE token_recuperacion (
  id_token    INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario  INT NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,       
  expira_en   DATETIME NOT NULL,
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_token_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cliente (
  id_cliente          INT AUTO_INCREMENT PRIMARY KEY,
  tipo                ENUM('persona_natural', 'empresa') NOT NULL,
  tipo_documento      ENUM('CC', 'CE', 'NIT', 'PASAPORTE') NOT NULL,
  nombre_razon_social VARCHAR(100) NOT NULL,
  documento           VARCHAR(20)  NOT NULL UNIQUE,
  telefono            VARCHAR(20),
  correo              VARCHAR(100),
  direccion           VARCHAR(150),
  activo              BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE categoria (
  id_categoria  INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE producto (
  id_producto     INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria    INT NOT NULL,
  codigo          VARCHAR(30)  NOT NULL UNIQUE,  
  nombre          VARCHAR(100) NOT NULL,
  descripcion     VARCHAR(255),                  
  unidad_medida   VARCHAR(20)  NOT NULL,      
  precio_compra   DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_venta    DECIMAL(12,2) NOT NULL,    
  porcentaje_iva  DECIMAL(5,2)  NOT NULL DEFAULT 19.00,
  stock_minimo    DECIMAL(12,2) NOT NULL DEFAULT 0,
  existencias     DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_producto_categoria
    FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria),
  CONSTRAINT chk_producto_precios
    CHECK (precio_compra >= 0 AND precio_venta >= 0),
  CONSTRAINT chk_producto_iva
    CHECK (porcentaje_iva >= 0 AND porcentaje_iva <= 100),
  CONSTRAINT chk_producto_stock
    CHECK (stock_minimo >= 0 AND existencias >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_producto_nombre ON producto (nombre);

CREATE TABLE venta (
  id_venta              INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente            INT NOT NULL,            
  id_usuario            INT NOT NULL,             
  numero                INT NOT NULL UNIQUE,     
  fecha_hora            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  medio_pago            ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
  subtotal              DECIMAL(12,2) NOT NULL,
  porcentaje_descuento  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  iva_total             DECIMAL(12,2) NOT NULL,
  total                 DECIMAL(12,2) NOT NULL,
  estado                ENUM('activa', 'anulada') NOT NULL DEFAULT 'activa',
  motivo_anulacion      VARCHAR(200),
  id_usuario_anulacion  INT NULL,               
  fecha_anulacion       DATETIME NULL,
  CONSTRAINT fk_venta_cliente
    FOREIGN KEY (id_cliente) REFERENCES cliente (id_cliente),
  CONSTRAINT fk_venta_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  CONSTRAINT fk_venta_usuario_anulacion
    FOREIGN KEY (id_usuario_anulacion) REFERENCES usuario (id_usuario),
  CONSTRAINT chk_venta_descuento
    CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100),
  CONSTRAINT chk_venta_anulacion
    CHECK (estado = 'activa' OR motivo_anulacion IS NOT NULL)
) ENGINE=InnoDB;

CREATE INDEX idx_venta_fecha ON venta (fecha_hora);

CREATE TABLE detalle_venta (
  id_detalle       INT AUTO_INCREMENT PRIMARY KEY,
  id_venta         INT NOT NULL,
  id_producto      INT NOT NULL,
  cantidad         DECIMAL(12,2) NOT NULL,
  precio_unitario  DECIMAL(12,2) NOT NULL,       
  porcentaje_iva   DECIMAL(5,2)  NOT NULL,       
  CONSTRAINT fk_detalle_venta
    FOREIGN KEY (id_venta) REFERENCES venta (id_venta),
  CONSTRAINT fk_detalle_producto
    FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
  CONSTRAINT chk_detalle_cantidad
    CHECK (cantidad > 0)
) ENGINE=InnoDB;


CREATE TABLE movimiento_inventario (
  id_movimiento           INT AUTO_INCREMENT PRIMARY KEY,
  id_producto             INT NOT NULL,
  id_usuario              INT NOT NULL,
  id_venta                INT NULL,                -- solo para venta / anulacion
  tipo                    ENUM('entrada', 'venta', 'anulacion', 'ajuste') NOT NULL,
  cantidad                DECIMAL(12,2) NOT NULL,
  existencias_resultantes DECIMAL(12,2) NOT NULL,
  nota                    VARCHAR(200),
  fecha_hora              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_producto
    FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
  CONSTRAINT fk_mov_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  CONSTRAINT fk_mov_venta
    FOREIGN KEY (id_venta) REFERENCES venta (id_venta)
) ENGINE=InnoDB;

CREATE INDEX idx_mov_producto_fecha ON movimiento_inventario (id_producto, fecha_hora);

CREATE VIEW v_productos_stock_bajo AS
SELECT
  p.id_producto,
  p.codigo,
  p.nombre,
  c.nombre AS categoria,
  p.existencias,
  p.stock_minimo,
  CASE WHEN p.existencias = 0 THEN 'agotado' ELSE 'bajo' END AS nivel
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
WHERE p.activo = TRUE
  AND p.existencias <= p.stock_minimo;


INSERT INTO rol (nombre) VALUES
  ('Administrador'),
  ('Vendedor/Cajero'),
  ('Encargado del Inventario');

INSERT INTO cliente (tipo, tipo_documento, nombre_razon_social, documento)
VALUES ('persona_natural', 'CC', 'Consumidor Final', '222222222222');

INSERT INTO categoria (nombre) VALUES
  ('Herramientas Eléctricas'),
  ('Herramientas Manuales'),
  ('Fontanería'),
  ('Obra Gris'),
  ('Fijaciones'),
  ('Pinturas'),
  ('Abrasivos'),
  ('Materiales Eléctricos');


INSERT INTO producto
  (id_categoria, codigo, nombre, descripcion, unidad_medida,
   precio_compra, precio_venta, porcentaje_iva, stock_minimo, existencias)
VALUES
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Herramientas Eléctricas'),
   'SKU-77021', 'Taladro Percutor DeWalt 1/2" 710W',
   'Mandril industrial 13 mm, reversible y velocidad variable',
   'unid', 290000, 323000, 19.00, 5, 14),
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Fontanería'),
   'SKU-33018', 'Tubo PVC Presión RDE 21 1/2" x 6 m',
   'Tubería para agua fría a presión',
   'tubos', 11000, 15000, 19.00, 20, 85),
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Obra Gris'),
   'SKU-44199', 'Cemento Gris 50 kg',
   'Uso general estructural tipo UG',
   'bultos', 25000, 30000, 19.00, 25, 120),
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Fijaciones'),
   'SKU-10492', 'Tornillo Drywall 6 x 1" Fosfatado (caja x 1000)',
   'Punta fina, rosca corrida',
   'cajas', 14000, 20000, 19.00, 12, 48),
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Pinturas'),
   'SKU-85432', 'Brocha Cerda Rubia 2-1/2"',
   'Para esmaltes, acrílicos y vinilos de acabado fino',
   'unid', 6500, 10000, 19.00, 10, 28),
  ((SELECT id_categoria FROM categoria WHERE nombre = 'Abrasivos'),
   'SKU-91024', 'Disco Corte Metal 4-1/2"',
   'Grosor 1.0 mm, corte fino y rápido',
   'unid', 2200, 3500, 19.00, 50, 8);
   
SHOW TABLES;
SELECT * FROM v_productos_stock_bajo;