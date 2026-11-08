import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { api } from '../api/cliente';
import { PAGOS } from '../utils/pagos';
import {
  etiquetaDocumento, formatoCantidad, formatoFecha, formatoHora, formatoPesos,
} from '../utils/formato';
import './DetalleVenta.css';

// En el ticket los precios se muestran con IVA incluido, como en el mockup
const precioConIva = (linea) => linea.precio_unitario * (1 + linea.porcentaje_iva / 100);

export default function DetalleVenta({ id, version, onCerrar }) {
  const [venta, setVenta] = useState(null);
  const [error, setError] = useState('');

  // "version" cambia cuando algo se modifica (por ejemplo, una anulación) y hay que recargar
  useEffect(() => {
    let vigente = true;
    api(`/ventas/${id}`)
      .then((v) => {
        if (vigente) {
          setVenta(v);
          setError('');
        }
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [id, version]);

  const pago = venta ? PAGOS[venta.medio_pago] : null;
  const IconoPago = pago?.icono;
  const descuento = venta ? Math.round(venta.subtotal * venta.porcentaje_descuento) / 100 : 0;
  const tarifas = venta ? new Set(venta.items.map((i) => i.porcentaje_iva)) : new Set();
  const etiquetaIva = tarifas.size === 1 ? `IVA liquidado (${[...tarifas][0]}%)` : 'IVA liquidado';

  return (
    <aside className="detalle-venta" aria-label="Detalle del ticket">
      <header className="detalle-cabecera">
        <h2>Detalle de ticket {venta ? `#${venta.ticket}` : ''}</h2>
        <button onClick={onCerrar} aria-label="Cerrar detalle"><X size={18} /></button>
      </header>

      {error && <div className="alerta-error detalle-margen" role="alert">{error}</div>}
      {!venta && !error && <p className="texto-suave detalle-margen">Cargando…</p>}

      {venta && (
        <div className="detalle-cuerpo">
          {venta.estado === 'anulada' && (
            <div className="detalle-anulada">
              <strong><TriangleAlert size={15} /> Venta anulada</strong>
              <span>Motivo: {venta.motivo_anulacion}</span>
              <span className="detalle-fino">
                Por {venta.anulada_por} · {formatoFecha(venta.fecha_anulacion)} {formatoHora(venta.fecha_anulacion)}
              </span>
            </div>
          )}

          <section className="detalle-bloque">
            <small>Cliente facturado</small>
            <strong>{venta.cliente}</strong>
            <span className="mono">{etiquetaDocumento(venta.tipo_documento)}: {venta.documento}</span>
            {venta.direccion_cliente && <span>{venta.direccion_cliente}</span>}
            <div className="detalle-fila">
              <span>Cajero / vendedor:</span>
              <strong className="detalle-azul">{venta.vendedor} ({venta.rol_vendedor})</strong>
            </div>
            <div className="detalle-fila">
              <span>Medio de pago:</span>
              <strong className="detalle-pago"><IconoPago size={14} /> {pago.texto}</strong>
            </div>
            <div className="detalle-fila">
              <span>Fecha:</span>
              <strong>{formatoFecha(venta.fecha_hora)} · {formatoHora(venta.fecha_hora)}</strong>
            </div>
          </section>

          <table className="detalle-tabla">
            <thead>
              <tr>
                <th>SKU / descripción</th>
                <th className="der">Cant</th>
                <th className="der">P. unit</th>
                <th className="der">Total</th>
              </tr>
            </thead>
            <tbody>
              {venta.items.map((linea) => (
                <tr key={linea.id_producto}>
                  <td>
                    <div className="detalle-sku mono">{linea.codigo}</div>
                    <div>{linea.nombre}</div>
                  </td>
                  <td className="der mono">{formatoCantidad(linea.cantidad)}</td>
                  <td className="der mono">{formatoPesos(precioConIva(linea))}</td>
                  <td className="der mono">{formatoPesos(precioConIva(linea) * linea.cantidad)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="detalle-totales">
            <div><span>Subtotal bruto:</span><span className="mono">{formatoPesos(venta.subtotal)} COP</span></div>
            <div>
              <span>Descuento comercial{venta.porcentaje_descuento > 0 ? ` (${venta.porcentaje_descuento}%)` : ''}:</span>
              <span className="mono">{formatoPesos(descuento)} COP</span>
            </div>
            <div><span>{etiquetaIva}:</span><span className="mono">{formatoPesos(venta.iva_total)} COP</span></div>
            <div className="detalle-total">
              <span>Total facturado:</span>
              <div>
                <div className="mono">{formatoPesos(venta.total)}</div>
                <small>COP</small>
              </div>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}