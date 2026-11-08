import { useEffect, useState } from 'react';
import { api } from '../api/cliente';

// La conversación se guarda por usuario en sessionStorage: sobrevive a recargas, no a cerrar la pestaña
const clave = (idUsuario) => `ferrogest_chat_${idUsuario}`;

function leer(idUsuario) {
  try {
    return JSON.parse(sessionStorage.getItem(clave(idUsuario))) ?? [];
  } catch {
    return [];
  }
}

const nuevoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function useChat(usuario) {
  const [mensajes, setMensajes] = useState(() => leer(usuario.id));
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(clave(usuario.id), JSON.stringify(mensajes.slice(-50)));
    } catch {
      /* si el navegador no deja guardar, la conversación sigue funcionando en memoria */
    }
  }, [mensajes, usuario.id]);

  async function enviar(texto) {
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    // El servidor recibe los últimos mensajes como contexto (sin los que fallaron)
    const historial = mensajes
      .filter((m) => !m.error)
      .slice(-10)
      .map((m) => ({ rol: m.rol, texto: m.texto }));

    setMensajes((actuales) => [...actuales, { id: nuevoId(), rol: 'user', texto: limpio, ts: Date.now() }]);
    setEnviando(true);

    try {
      const r = await api('/chat', { metodo: 'POST', cuerpo: { mensaje: limpio, historial } });
      setMensajes((actuales) => [
        ...actuales,
        { id: nuevoId(), rol: 'assistant', texto: r.respuesta, tarjetas: r.tarjetas ?? [], ts: Date.now() },
      ]);
    } catch (e) {
      setMensajes((actuales) => [
        ...actuales,
        { id: nuevoId(), rol: 'assistant', texto: e.message, error: true, ts: Date.now() },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  const limpiar = () => setMensajes([]);

  return { mensajes, enviando, enviar, limpiar };
}