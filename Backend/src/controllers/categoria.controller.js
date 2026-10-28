
const Categoria = require("../models/categoria.model");

const listar = async (req, res) => {
    try {
        const categorias = await Categoria.obtenerTodas();

        res.json({
            estado: "OK",
            datos: categorias
        });
    } catch (error) {
        res.status(500).json({
            estado: "ERROR",
            mensaje: "No se pudieron obtener las categorías"
        });
    }
};

module.exports = {
    listar
};
