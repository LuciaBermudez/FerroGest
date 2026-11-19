const express = require('express');
const cors = require('cors');

const app = express();

const pool = require('./config/db.js');

// Orígenes permitidos: lista separada por comas en CORS_ORIGIN.
// En desarrollo se permiten los dos orígenes habituales de Vite.
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

app.disable('x-powered-by');

// Si la app está detrás de un proxy (Railway, Render, etc.) se activa con TRUST_PROXY=true
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

// Cabeceras de seguridad básicas. Se evita añadir dependencias solo para esto.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      // Sin Origin (curl, health checks, mismo origen) no hay nada que autorizar
      if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    const [resultado] = await pool.query('SELECT DATABASE() AS base');
    res.json({
      estado: 'OK',
      backend: 'FerroGest',
      baseDatos: resultado[0].base,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      estado: 'ERROR',
      mensaje: 'No se pudo conectar con la base de datos',
    });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/categorias', require('./routes/categoria.routes'));
app.use('/api/productos', require('./routes/producto.routes'));
app.use('/api/movimientos', require('./routes/movimiento.routes'));
app.use('/api/ventas', require('./routes/venta.routes'));
app.use('/api/clientes', require('./routes/cliente.routes'));
app.use('/api/usuarios', require('./routes/usuario.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/chat', require('./routes/chat.routes'));

// Cualquier ruta desconocida responde en JSON (la API no sirve HTML)
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Manejo centralizado de errores: JSON mal formado, cuerpos demasiado grandes, etc.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la solicitud no es JSON válido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'El cuerpo de la solicitud es demasiado grande' });
  }

  console.error(error);
  res.status(500).json({ mensaje: 'Error del servidor' });
});

module.exports = app;
