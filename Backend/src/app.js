const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();

app.use(cors());
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

module.exports = app;