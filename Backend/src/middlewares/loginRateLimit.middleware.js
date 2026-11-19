// Límite de intentos de login por IP + correo. Es memoria local del proceso:
// suficiente para una sola instancia; con varias instancias usar Redis.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLOS = 5;
const MAX_ENTRADAS = 5000;

const intentos = new Map();

function limpiarExpirados() {
  const ahora = Date.now();
  for (const [clave, registro] of intentos) {
    if (registro.expira <= ahora) intentos.delete(clave);
  }
}

function claveDe(req) {
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
  return correo ? `${req.ip}|${correo}` : null;
}

function limitarLogin(req, res, next) {
  const clave = claveDe(req);
  if (!clave) return next();

  if (intentos.size > MAX_ENTRADAS) limpiarExpirados();

  const ahora = Date.now();
  const registro = intentos.get(clave);

  if (registro && registro.expira > ahora && registro.fallos >= MAX_FALLOS) {
    res.set('Retry-After', String(Math.ceil((registro.expira - ahora) / 1000)));
    return res.status(429).json({
      mensaje: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
    });
  }

  // Se cuenta el resultado real del login, no solo el intento:
  // los errores de validación (400) no bloquean la cuenta.
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const actual = intentos.get(clave);
      const vigente =
        actual && actual.expira > Date.now()
          ? actual
          : { fallos: 0, expira: Date.now() + VENTANA_MS };
      vigente.fallos += 1;
      intentos.set(clave, vigente);
    } else if (res.statusCode === 200) {
      intentos.delete(clave);
    }
  });

  return next();
}

module.exports = { limitarLogin };
