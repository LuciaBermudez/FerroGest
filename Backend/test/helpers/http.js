require('./setup');

const http = require('node:http');
const app = require('../../src/app');
const { CLAVE } = require('./db');

async function iniciarServidor() {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  return {
    base,
    cerrar: async () => {
      servidor.closeAllConnections?.();
      await new Promise((resolve, reject) =>
        servidor.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}

async function pedir(base, ruta, { metodo = 'GET', token, cuerpo, crudo, cabeceras = {} } = {}) {
  const headers = { ...cabeceras };
  let body;

  if (crudo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = crudo;
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${base}${ruta}`, { method: metodo, headers, body });
  const texto = await respuesta.text();

  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }

  return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
}

async function iniciarSesion(base, correo, clave = CLAVE) {
  const respuesta = await pedir(base, '/api/auth/login', {
    metodo: 'POST',
    cuerpo: { correo, contrasena: clave },
  });
  return respuesta.datos?.token;
}

module.exports = { iniciarServidor, pedir, iniciarSesion };
