
const express = require("express");

const app = express();

const categoriaRoutes = require("./routes/categoria.routes");
const productoRoutes = require("./routes/producto.routes");
const pool = require("./config/database");

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        mensaje: "Backend de FerroGest funcionando"
    });
});

app.get("/api/health", async (req, res) => {
    try {
        const [resultado] = await pool.query(
            "SELECT DATABASE() AS base"
        );

        res.json({
            estado: "OK",
            backend: "FerroGest",
            baseDatos: resultado[0].base
        });
    } catch (error) {
        res.status(500).json({
            estado: "ERROR",
            mensaje: "No se pudo conectar con la base de datos"
        });
    }
});

app.use("/api/categorias", categoriaRoutes);
app.use("/api/productos", productoRoutes);

module.exports = app;
