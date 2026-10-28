
const pool = require("../config/database");

const obtenerTodos = async () => {
    const [productos] = await pool.query(`
        SELECT p.*, c.nombre AS categoria
        FROM producto p
        INNER JOIN categoria c
            ON p.id_categoria = c.id_categoria
        ORDER BY p.id_producto ASC
    `);

    return productos;
};

const crear = async (producto) => {
    const {
        id_categoria,
        codigo,
        nombre,
        descripcion,
        precio_compra,
        precio_venta,
        stock_actual,
        stock_minimo,
        unidad_medida
    } = producto;

    const [resultado] = await pool.query(
        `INSERT INTO producto (
            id_categoria,
            codigo,
            nombre,
            descripcion,
            precio_compra,
            precio_venta,
            stock_actual,
            stock_minimo,
            unidad_medida
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id_categoria,
            codigo,
            nombre,
            descripcion || null,
            precio_compra,
            precio_venta,
            stock_actual ?? 0,
            stock_minimo ?? 0,
            unidad_medida || "unidad"
        ]
    );

    return resultado.insertId;
};

module.exports = {
    obtenerTodos,
    crear
};
