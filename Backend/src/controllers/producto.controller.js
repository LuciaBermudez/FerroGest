
const Producto = require("../models/producto.model");

const listar = async (req, res) => {
    try {
        const productos = await Producto.obtenerTodos();

        res.json({
            estado: "OK",
            datos: productos
        });
    } catch (error) {
        console.error("Error al listar productos:", error.message);

        res.status(500).json({
            estado: "ERROR",
            mensaje: "No se pudieron obtener los productos"
        });
    }
};

const crear = async (req, res) => {
    try {
        const {
            id_categoria,
            codigo,
            nombre,
            precio_compra,
            precio_venta
        } = req.body;

        if (
            !id_categoria ||
            !codigo?.trim() ||
            !nombre?.trim() ||
            precio_compra === undefined ||
            precio_venta === undefined
        ) {
            return res.status(400).json({
                estado: "ERROR",
                mensaje: "Categoría, código, nombre y precios son obligatorios"
            });
        }

        const valoresNumericos = [
            id_categoria,
            precio_compra,
            precio_venta,
            req.body.stock_actual ?? 0,
            req.body.stock_minimo ?? 0
        ];

        if (
            !valoresNumericos.every(
                valor => Number.isFinite(Number(valor))
            ) ||
            Number(id_categoria) <= 0 ||
            Number(precio_compra) < 0 ||
            Number(precio_venta) < 0 ||
            Number(req.body.stock_actual ?? 0) < 0 ||
            Number(req.body.stock_minimo ?? 0) < 0
        ) {
            return res.status(400).json({
                estado: "ERROR",
                mensaje: "Los valores numéricos deben ser válidos y no negativos"
            });
        }

        const id = await Producto.crear({
            ...req.body,
            codigo: codigo.trim(),
            nombre: nombre.trim()
        });

        res.status(201).json({
            estado: "OK",
            mensaje: "Producto registrado correctamente",
            id_producto: id
        });
    } catch (error) {
        console.error("Error al crear producto:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                estado: "ERROR",
                mensaje: "El código del producto ya existe"
            });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                estado: "ERROR",
                mensaje: "La categoría seleccionada no existe"
            });
        }

        res.status(500).json({
            estado: "ERROR",
            mensaje: "No se pudo registrar el producto"
        });
    }
};

module.exports = {
    listar,
    crear
};
