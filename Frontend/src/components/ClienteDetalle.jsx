import { useEffect, useState } from 'react';
import { FileText, Mail, MapPin, Phone, X } from 'lucide-react';
import { api } from '../api/cliente';
import { PAGOS } from '../utils/pagos';
import { etiquetaDocumento, formatoDocumento, formatoFecha, formatoNumero, formatoPesos, iniciales } from '../utils/formato';
import './ClienteDetalle.css';

export default function ClienteDetalle({ id, version, esAdmin, onCerrar, onVerTodas, onCambioEstado }) {
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState('');

  // "version" cambia cuando algo se modifica (edición, cambio de estado) y hay que recargar
  useEffect(() => {
    let vigente = true;
    api(`/clientes/${id}`)
      .then((c) => {
        if (vigente) {
          setCliente(c);
          setError('');
        }
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [id, version]);

  async function alternarEstado() {
    const nuevo = !cliente.activo;
    const pregunta = nuevo
      ? `¿Activar a "${cliente.nombre_razon_social}"?`
      : `¿Desactivar a "${cliente.nombre_razon_social}"? Ya no se podrá usar en nuevas ventas.`;
    if (!window.confirm(pregunta)) return;

    try {
      await api(`/clientes/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo: nuevo } });
      onCambioEstado(`Cliente ${nuevo ? 'activado' : 'desactivado'}`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !cliente) return <section className="cl-detalle"><div className="alerta-error">{error}</div></section>;
  if (!cliente) return <section className="cl-detalle"><p className="texto-suave">Cargando…</p></section>;

  const esEmpresa = cliente.tipo === 'empresa';
  // Solo el administrador recibe el historial (regla del backend)
  const tieneHistorial = Array.isArray(cliente.compras);

  return (
    <section className="cl-detalle" aria-label={`Detalle de ${cliente.nombre_razon_social}`}>
      <header className="cl-detalle-cabecera">
        <div className="cl-avatar">{iniciales(cliente.nombre_razon_social)}</div>
        <div className="cl-detalle-titulo">
          <h2>
            {cliente.nombre_razon_social}
            <span className="cl-tipo">{esEmpresa ? 'Empresa' : 'Persona natural'}</span>
            {!cliente.activo && <span className="cl-estado inactivo">Inactivo</span>}
          </h2>
          <span className="mono">
            {etiquetaDocumento(cliente.tipo_documento)}: {formatoDocumento(cliente.tipo_documento, cliente.documento)}
          </span>
        </div>
        {esAdmin && (
          <button className="boton-suave" onClick={alternarEstado}>
            {cliente.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
        <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar detalle"><X size={20} /></button>
      </header>

      {error && <div className="alerta-error" role="alert">{error}</div>}

      <div className="cl-contacto">
        <div>
          <small><Phone size={13} /> Teléfono / móvil</small>
          <span className="mono">{cliente.telefono || '—'}</span>
        </div>
        <div>
          <small><Mail size={13} /> Correo electrónico</small>
          <span>{cliente.correo || '—'}</span>
        </div>
        <div className="ancho">
          <small><MapPin size={13} /> Dirección de entrega principal</small>
          <span>{cliente.direccion || '—'}</span>
        </div>
      </div>

      {tieneHistorial && (
        <>
          <div className="cl-total">
            <small>Total acumulado comprado</small>
            <div>
              <strong className="mono">{formatoPesos(cliente.total_comprado)} COP</strong>
              <span>{formatoNumero(cliente.num_compras)} {cliente.num_compras === 1 ? 'compra' : 'compras'}</span>
            </div>
          </div>

          <div>
            <div className="cl-historial-cab">
              <h3><FileText size={18} /> Historial de compras asociadas</h3>
              {cliente.compras.length > 0 && (
                <button className="enlace cl-ver-todas" onClick={() => onVerTodas(cliente.id_cliente)}>Ver todas</button>
              )}
            </div>

            {cliente.compras.length === 0 ? (
              <p className="texto-suave">Este cliente aún no tiene compras.</p>
            ) : (
              <div className="cl-compras-envoltorio">
                <table className="cl-compras">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Ticket</th>
                      <th className="der">Total</th>
                      <th>Medio de pago</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cliente.compras.map((compra) => {
                      const pago = PAGOS[compra.medio_pago];
                      const IconoPago = pago.icono;
                      return (
                        <tr key={compra.id_venta}>
                          <td>{formatoFecha(compra.fecha_hora)}</td>
                          <td className="mono cl-ticket">#{compra.ticket}</td>
                          <td className="der mono">{formatoPesos(compra.total)} COP</td>
                          <td><span className="cl-pago"><IconoPago size={14} /> {pago.texto}</span></td>
                          <td>
                            <span className={`cl-pill ${compra.estado}`}>{compra.estado === 'anulada' ? 'Anulada' : 'Activa'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}