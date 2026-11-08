import { useEffect, useRef, useState } from 'react';
import { Bot, CircleX, Send, Trash2, TrendingUp, User, Warehouse, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { ROLES } from '../utils/roles';
import { formatoHoraCorta } from '../utils/formato';
import TarjetasChat from './TarjetasChat';
import './AsistenteChat.css';

const PREGUNTAS_RAPIDAS = [
  { etiqueta: '¿Ventas de hoy?', mensaje: '¿Cuánto hemos vendido hoy?', icono: TrendingUp, soloAdmin: true },
  { etiqueta: '¿Productos agotados?', mensaje: '¿Qué productos están agotados?', icono: CircleX },
  { etiqueta: '¿Stock por reponer?', mensaje: '¿Qué productos hay que reponer?', icono: Warehouse },
];

export default function AsistenteChat() {
  const { usuario } = useAuth();
  const chat = useChat(usuario);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const cuerpoRef = useRef(null);
  const entradaRef = useRef(null);

  const esAdmin = usuario.rol === ROLES.ADMIN;

  useEffect(() => {
    if (!abierto) return undefined;
    entradaRef.current?.focus();
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  // Siempre se muestra el mensaje más reciente
  useEffect(() => {
    if (abierto && cuerpoRef.current) cuerpoRef.current.scrollTop = cuerpoRef.current.scrollHeight;
  }, [abierto, chat.mensajes, chat.enviando]);

  if (!abierto) {
    return (
      <button className="chat-fab" onClick={() => setAbierto(true)} aria-label="Abrir asistente inteligente" title="Asistente inteligente">
        <Bot size={20} />
      </button>
    );
  }

  function enviar(evento) {
    evento.preventDefault();
    chat.enviar(texto);
    setTexto('');
  }

  const rapidas = PREGUNTAS_RAPIDAS.filter((p) => !p.soloAdmin || esAdmin);
  const primero = chat.mensajes[0];

  return (
    <section className="chat-panel" role="dialog" aria-label="Asistente inteligente">
      <header className="chat-cab">
        <span className="chat-cab-icono"><Bot size={22} /></span>
        <div className="chat-cab-titulo">
          <strong>Asistente Inteligente</strong>
          <span><i /> Conectado al stock en tiempo real</span>
        </div>
        {chat.mensajes.length > 0 && (
          <button className="chat-cab-boton" onClick={chat.limpiar} title="Nueva conversación" aria-label="Nueva conversación">
            <Trash2 size={17} />
          </button>
        )}
        <button className="chat-cab-boton" onClick={() => setAbierto(false)} aria-label="Cerrar asistente">
          <X size={19} />
        </button>
      </header>

      <div className="chat-cuerpo" ref={cuerpoRef}>
        <span className="chat-fecha mono">Hoy{primero ? `, ${formatoHoraCorta(primero.ts)}` : ''}</span>

        {chat.mensajes.length === 0 && (
          <div className="chat-msg asistente">
            <span className="chat-avatar bot"><Bot size={16} /></span>
            <div className="chat-contenido">
              <div className="chat-burbuja">
                Hola, soy el asistente de FerroGest. Puedo consultar existencias, precios{esAdmin ? ' y ventas' : ''}.
                ¿En qué te ayudo?
              </div>
            </div>
          </div>
        )}

        {chat.mensajes.map((m) => {
          const esUsuario = m.rol === 'user';
          return (
            <div key={m.id} className={`chat-msg ${esUsuario ? 'usuario' : 'asistente'}`}>
              <span className={`chat-avatar ${esUsuario ? 'yo' : 'bot'}`}>
                {esUsuario ? <User size={16} /> : <Bot size={16} />}
              </span>
              <div className="chat-contenido">
                <div className={`chat-burbuja ${m.error ? 'error' : ''}`}>{m.texto}</div>
                {!esUsuario && <TarjetasChat tarjetas={m.tarjetas} />}
                <div className="chat-hora mono">
                  {formatoHoraCorta(m.ts)} · {esUsuario ? 'Tú' : 'FerroGest Core IA'}
                </div>
              </div>
            </div>
          );
        })}

        {chat.enviando && (
          <div className="chat-msg asistente">
            <span className="chat-avatar bot"><Bot size={16} /></span>
            <div className="chat-contenido">
              <div className="chat-burbuja">
                <span className="chat-escribiendo" aria-label="Consultando"><i /><i /><i /></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-chips">
        {rapidas.map(({ etiqueta, mensaje, icono: Icono }) => (
          <button key={etiqueta} className="chat-chip" disabled={chat.enviando} onClick={() => chat.enviar(mensaje)}>
            <Icono size={14} /> {etiqueta}
          </button>
        ))}
      </div>

      <form className="chat-form" onSubmit={enviar}>
        <input
          ref={entradaRef} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Pregunta sobre existencias, precios o ventas…" aria-label="Escribe tu pregunta"
        />
        <button type="submit" disabled={!texto.trim() || chat.enviando} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}