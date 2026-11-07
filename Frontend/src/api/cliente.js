const TOKEN_KEY = 'ferrogest_token';

export const guardarToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const obtenerToken = () => localStorage.getItem(TOKEN_KEY);
export const borrarToken = () => localStorage.removeItem(TOKEN_KEY);

export class ErrorApi extends Error {
  constructor(mensaje, estado, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles; // lista de errores de validación, si el servidor la envía
  }
}

// Función que la sesión registra para cerrarse sola si el servidor responde 401
let alExpirarSesion = null;
export function registrarAlExpirarSesion(funcion) {
  alExpirarSesion = funcion;
}

export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const cabeceras = {};
  const token = obtenerToken();
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor', 0);
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Un 401 fuera del login significa sesión vencida o usuario desactivado
    if (respuesta.status === 401 && ruta !== '/auth/login' && alExpirarSesion) {
      alExpirarSesion();
    }
    throw new ErrorApi(datos?.mensaje || 'Ocurrió un error inesperado', respuesta.status, datos?.errores);
  }

  return datos;
}