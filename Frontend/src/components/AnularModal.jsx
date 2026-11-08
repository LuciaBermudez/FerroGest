import { useEffect, useState } from 'react';
import { Ban, X } from 'lucide-react';
import { api } from '../api/cliente';
import { formatoPesos } from '../utils/formato';
import './AnularModal.css';

export default function AnularModal({ venta, onCerrar, onAnulada }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  async function enviar(evento) {
    evento.preventDefault();
    if (!motivo.trim()) return setError('Escribe el motivo de la anulación');

    setError('');
    setGuardando(true);
    try {
      await api(`/ventas/${venta.id_venta}/anular`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() } });
      onAnulada(`Venta ${venta.ticket} anulada y stock devuelto al inventario`);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Anular venta">
        <header className="modal-cabecera">
          <div className="modal-titulo">
            <span className="modal-icono peligro"><Ban size={20} /></span>
            <div>
              <h2>Anular venta</h2>
              <span className="modal-subtitulo mono">{venta.ticket} · {formatoPesos(venta.total)} COP</span>
            </div>
          </div>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="modal-cuerpo">
          {error && <div className="alerta-error" role="alert">{error}</div>}

          <div className="aviso-anulacion">
            Se devolverá al inventario el stock de todos los productos de esta venta.
            Esta acción no se puede deshacer.
          </div>

          <div>
            <label className="modal-etiqueta" htmlFor="motivo">Motivo de la anulación *</label>
            <textarea
              id="motivo" autoFocus maxLength={200} rows={3}
              placeholder="Ej: El cliente devolvió la mercancía"
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
            />
            <span className="contador">{motivo.length}/200</span>
          </div>
        </div>

        <footer className="modal-pie">
          <span />
          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton-peligro" disabled={guardando}>
              {guardando ? 'Anulando…' : 'Anular venta'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}