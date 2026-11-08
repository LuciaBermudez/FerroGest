import { useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Save, UserPlus, X } from 'lucide-react';
import { api } from '../api/cliente';
import './ClienteForm.css';

// Una empresa solo usa NIT; una persona natural nunca (igual que el backend)
const DOCUMENTOS = { persona_natural: ['CC', 'CE', 'PASAPORTE'], empresa: ['NIT'] };
const NOMBRE_DOCUMENTO = { CC: 'Cédula (CC)', CE: 'Cédula de extranjería (CE)', PASAPORTE: 'Pasaporte', NIT: 'NIT' };
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function valoresIniciales(c) {
  return {
    tipo: c?.tipo ?? 'persona_natural',
    tipo_documento: c?.tipo_documento ?? 'CC',
    documento: c?.documento ?? '',
    nombre_razon_social: c?.nombre_razon_social ?? '',
    telefono: c?.telefono ?? '',
    correo: c?.correo ?? '',
    direccion: c?.direccion ?? '',
  };
}

export default function ClienteForm({ cliente, onCerrar, onGuardado }) {
  const editando = Boolean(cliente);
  const [datos, setDatos] = useState(() => valoresIniciales(cliente));
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

    // Mismo formato que guarda el servidor: sin puntos ni espacios
    const documento = datos.documento.replace(/[.\s]/g, '');
    const nombre = datos.nombre_razon_social.trim();
    const correo = datos.correo.trim();

    if (!nombre) return setError('Escribe el nombre o la razón social');
    if (!/^[A-Za-z0-9-]{4,20}$/.test(documento)) {
      return setError('El documento debe tener entre 4 y 20 caracteres (letras, números o guion)');
    }
    if (correo && !REGEX_CORREO.test(correo)) return setError('El correo no es válido');

    setError('');
    setGuardando(true);

    const cuerpo = {
      ...datos,
      documento,
      nombre_razon_social: nombre,
      telefono: datos.telefono.trim(),
      correo,
      direccion: datos.direccion.trim(),
    };

    try {
      if (editando) {
        await api(`/clientes/${cliente.id_cliente}`, { metodo: 'PUT', cuerpo });
        onGuardado(`Cliente "${nombre}" actualizado`, cliente.id_cliente);
      } else {
        const creado = await api('/clientes', { metodo: 'POST', cuerpo });
        onGuardado(`Cliente "${nombre}" creado`, creado.id_cliente);
      }
    } catch (e) {
      setError(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Formulario de cliente">
        <header className="modal-cabecera">
          <div className="modal-titulo">
            <span className="modal-icono"><UserPlus size={20} /></span>
            <div>
              <h2>{editando ? 'Editar cliente' : 'Registrar nuevo cliente'}</h2>
              <span className="modal-subtitulo">Alta en base maestra comercial</span>
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
            <label className="modal-etiqueta" htmlFor="cf-nombre">
              {datos.tipo === 'empresa' ? 'Razón social *' : 'Nombre completo *'}
            </label>
            <input
              id="cf-nombre" type="text" autoFocus maxLength={100}
              placeholder="Ej: Carlos Alberto Gómez / Inversiones FerroAndina S.A.S."
              value={datos.nombre_razon_social} onChange={poner('nombre_razon_social')}
            />
          </div>

          <div className="fila-doble">
            <div>
              <label className="modal-etiqueta" htmlFor="cf-tipodoc">Tipo doc *</label>
              <select id="cf-tipodoc" value={datos.tipo_documento} onChange={poner('tipo_documento')}>
                {DOCUMENTOS[datos.tipo].map((t) => <option key={t} value={t}>{NOMBRE_DOCUMENTO[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="modal-etiqueta" htmlFor="cf-documento">Número de documento *</label>
              <input
                id="cf-documento" type="text" maxLength={25} className="mono"
                placeholder="Ej: 1.020.890.345 o 900.548.120-3"
                value={datos.documento} onChange={poner('documento')}
              />
            </div>
          </div>

          <div>
            <label className="modal-etiqueta etiqueta-fila" htmlFor="cf-telefono">
              Teléfono / móvil <span className="opcional">(Opcional)</span>
            </label>
            <div className="campo-icono">
              <Phone size={16} />
              <input id="cf-telefono" type="text" inputMode="tel" maxLength={20} placeholder="+57 300 123 4567"
                value={datos.telefono} onChange={poner('telefono')} />
            </div>
          </div>

          <div>
            <label className="modal-etiqueta etiqueta-fila" htmlFor="cf-correo">
              Correo electrónico (facturación) <span className="opcional">(Opcional)</span>
            </label>
            <div className="campo-icono">
              <Mail size={16} />
              <input id="cf-correo" type="email" maxLength={100} placeholder="facturacion@empresa.com"
                value={datos.correo} onChange={poner('correo')} />
            </div>
          </div>

          <div>
            <label className="modal-etiqueta etiqueta-fila" htmlFor="cf-direccion">
              Dirección de entrega / despacho <span className="opcional">(Opcional)</span>
            </label>
            <div className="campo-icono">
              <MapPin size={16} />
              <input id="cf-direccion" type="text" maxLength={150} placeholder="Calle, carrera, barrio o punto de referencia en obra…"
                value={datos.direccion} onChange={poner('direccion')} />
            </div>
          </div>
        </div>

        <footer className="modal-pie">
          <span />
          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              <Save size={16} />
              {guardando ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}