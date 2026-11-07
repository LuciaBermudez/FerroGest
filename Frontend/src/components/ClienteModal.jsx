import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { api } from '../api/cliente';
import './ClienteModal.css';

const VACIO = {
  tipo: 'persona_natural', tipo_documento: 'CC', documento: '',
  nombre_razon_social: '', telefono: '', correo: '', direccion: '',
};
// Una empresa solo usa NIT; una persona natural nunca (igual que el backend)
const DOCUMENTOS = { persona_natural: ['CC', 'CE', 'PASAPORTE'], empresa: ['NIT'] };
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClienteModal({ onUsar, onGenerico, onCerrar }) {
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const cambiarTipo = (tipo) => setDatos((d) => ({ ...d, tipo, tipo_documento: DOCUMENTOS[tipo][0] }));

  async function enviar(evento) {
    evento.preventDefault();
    setError('');

    // Mismo formato que guarda el servidor: sin puntos ni espacios
    const documento = datos.documento.replace(/[.\s]/g, '');
    const nombre = datos.nombre_razon_social.trim();

    if (!nombre) return setError('Escribe el nombre o la razón social');
    if (!/^[A-Za-z0-9-]{4,20}$/.test(documento)) {
      return setError('El documento debe tener entre 4 y 20 caracteres (letras, números o guion)');
    }
    if (datos.correo.trim() && !REGEX_CORREO.test(datos.correo.trim())) {
      return setError('El correo no es válido');
    }

    setGuardando(true);
    try {
      // ¿Ya existe un cliente con ese documento?
      const encontrados = await api(`/clientes?buscar=${encodeURIComponent(documento)}&limite=20`);
      const existente = encontrados.datos.find((c) => c.documento.toLowerCase() === documento.toLowerCase());

      if (existente) {
        if (!existente.activo) {
          throw new Error('Ese cliente está desactivado. Pídele al administrador que lo active.');
        }
        onUsar(existente, { yaExistia: true });
        return;
      }

      const cuerpo = { ...datos, documento, nombre_razon_social: nombre };
      const creado = await api('/clientes', { metodo: 'POST', cuerpo });
      onUsar({ ...cuerpo, id_cliente: creado.id_cliente, activo: true }, { yaExistia: false });
    } catch (e) {
      setError(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Datos del cliente">
        <header className="modal-cabecera">
          <div className="modal-titulo">
            <span className="modal-icono"><UserPlus size={20} /></span>
            <div>
              <h2>Datos del cliente</h2>
              <span className="modal-subtitulo">Facturación de la venta</span>
            </div>
          </div>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="modal-cuerpo">
          {error && <div className="alerta-error" role="alert">{error}</div>}

          <div>
            <span className="modal-etiqueta">Tipo de cliente *</span>
            <div className="opciones-tipo">
              <label className={`opcion-tipo ${datos.tipo === 'persona_natural' ? 'activa' : ''}`}>
                <input type="radio" name="tipo" checked={datos.tipo === 'persona_natural'} onChange={() => cambiarTipo('persona_natural')} />
                Persona natural
              </label>
              <label className={`opcion-tipo ${datos.tipo === 'empresa' ? 'activa' : ''}`}>
                <input type="radio" name="tipo" checked={datos.tipo === 'empresa'} onChange={() => cambiarTipo('empresa')} />
                Empresa
              </label>
            </div>
          </div>

          <div>
            <label className="modal-etiqueta" htmlFor="nombre">Nombre o razón social *</label>
            <input id="nombre" type="text" autoFocus maxLength={100} placeholder="Ej: Carlos Alberto Gómez / Inversiones FerroAndina S.A.S."
              value={datos.nombre_razon_social} onChange={poner('nombre_razon_social')} />
          </div>

          <div className="fila-doble">
            <div>
              <label className="modal-etiqueta" htmlFor="tipodoc">Tipo doc *</label>
              <select id="tipodoc" value={datos.tipo_documento} onChange={poner('tipo_documento')}>
                {DOCUMENTOS[datos.tipo].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="modal-etiqueta" htmlFor="documento">Número de documento *</label>
              <input id="documento" type="text" maxLength={25} placeholder="Ej: 1.020.456.789 o 900.542.119-4"
                value={datos.documento} onChange={poner('documento')} />
            </div>
          </div>

          <div>
            <label className="modal-etiqueta" htmlFor="telefono">Teléfono / móvil (opcional)</label>
            <input id="telefono" type="text" maxLength={20} value={datos.telefono} onChange={poner('telefono')} />
          </div>
          <div>
            <label className="modal-etiqueta" htmlFor="correo">Correo electrónico (opcional)</label>
            <input id="correo" type="email" maxLength={100} value={datos.correo} onChange={poner('correo')} />
          </div>
          <div>
            <label className="modal-etiqueta" htmlFor="direccion">Dirección (opcional)</label>
            <input id="direccion" type="text" maxLength={150} value={datos.direccion} onChange={poner('direccion')} />
          </div>
        </div>

        <footer className="modal-pie">
          <button type="button" className="enlace" onClick={onGenerico}>Usar Consumidor Final</button>
          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Usar en esta venta'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}