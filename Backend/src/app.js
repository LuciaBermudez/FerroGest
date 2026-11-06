const express = require('express');
const cors = require('cors');

const app = express();

const pool = require("./config/db.js");

app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT COUNT(*) AS productos FROM producto');
    res.json({
      estado: 'ok',
      base_de_datos: 'conectada',
      productos: filas[0].productos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      estado: 'error',
      mensaje: 'No se pudo conectar a la base de datos',
    });
  }
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
app.use('/api/categorias', require('./routes/categoria.routes'));
app.use('/api/productos', require('./routes/producto.routes'));

module.exports = app;
