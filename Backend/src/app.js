
const express = require("express");

const app = express();

const pool = require("./config/db.js");

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

app.use('/api/auth', require('./routes/auth.routes'));

module.exports = app;
