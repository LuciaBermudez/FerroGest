
const pool = require("../config/database");

const obtenerTodas = async () => {
    const [categorias] = await pool.query(
        "SELECT * FROM categoria ORDER BY id_categoria ASC"
    );

    return categorias;
};

module.exports = {
    obtenerTodas
};
