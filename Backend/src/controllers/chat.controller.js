const { ErrorNegocio } = require('../services/inventario.service');
const { responder } = require('../services/asistente.service');

// Límite simple en memoria: 15 preguntas por minuto por usuario (controla el costo)
const VENTANA_MS = 60000;
const MAX_POR_VENTANA = 15;
const intentos = new Map();

function excedeLimite(idUsuario) {
  const ahora = Date.now();
  const recientes = (intentos.get(idUsuario) || []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) {
    intentos.set(idUsuario, recientes);
    return true;
  }
  recientes.push(ahora);
  intentos.set(idUsuario, recientes);
  return false;
}

// El historial lo envía el frontend: [{ rol: 'user' | 'assistant', texto }]
function limpiarHistorial(historial) {
  if (!Array.isArray(historial)) return [];

  const limpio = historial
    .slice(-10)
    .filter((m) => (m.rol === 'user' || m.rol === 'assistant') && typeof m.texto === 'string' && m.texto.trim())
    .map((m) => ({ role: m.rol, content: m.texto.trim().slice(0, 1000) }));

  // La conversación debe empezar con un mensaje del usuario (se descarta el saludo inicial del asistente)
  while (limpio.length > 0 && limpio[0].role !== 'user') limpio.shift();
  return limpio;
}

// POST /api/chat  { mensaje, historial? }
async function conversar(req, res) {
  const mensaje = typeof req.body.mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (!mensaje) {
    return res.status(400).json({ mensaje: 'Escribe una pregunta' });
  }
  if (mensaje.length > 500) {
    return res.status(400).json({ mensaje: 'La pregunta no puede superar los 500 caracteres' });
  }
  if (excedeLimite(req.usuario.id)) {
    return res.status(429).json({ mensaje: 'Demasiadas preguntas seguidas. Espera un momento.' });
  }

  try {
    const respuesta = await responder({
      historial: limpiarHistorial(req.body.historial),
      mensaje,
      usuario: req.usuario,
    });
    res.json({ respuesta });
  } catch (error) {
    if (error instanceof ErrorNegocio) {
      return res.status(error.estado).json({ mensaje: error.message });
    }
    console.error(error);
    res.status(502).json({ mensaje: 'El asistente no está disponible por ahora. Intenta de nuevo en un momento.' });
  }
}

module.exports = { conversar };