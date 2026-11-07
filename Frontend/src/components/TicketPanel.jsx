import { useEffect, useState } from 'react';
import {
  Banknote, Building2, CircleCheck, CreditCard, Landmark, Minus, Pencil, Plus, ReceiptText, ShoppingCart, User, X,
} from 'lucide-react';
import { formatoNumero, formatoPesos } from '../utils/formato';
import { precioConIva, totalLinea } from '../utils/venta';
import './TicketPanel.css';

const FORMAS_PAGO = [
  { valor: 'efectivo', texto: 'Efectivo', icono: Banknote },
  { valor: 'tarjeta', texto: 'Tarjeta', icono: CreditCard },
  { valor: 'transferencia', texto: 'Transferencia', icono: Landmark },
];
const NOMBRE_PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

const Pesos = ({ valor }) => <>{formatoPesos(valor)} COP</>;

// Campo de cantidad: deja escribir libremente y aplica el límite del stock
function CampoCantidad({ valor, maximo, onCambio }) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    setTexto(String(valor));
  }, [valor]);

  function alCambiar(e) {
    const limpio = e.target.value.replace(/[^\d.]/g, '');
    setTexto(limpio);
    const n = Number(limpio);
    if (n > 0) onCambio(n);
  }

  return (
    <input
      className="cantidad mono"
      inputMode="decimal"
      value={texto}
      onChange={alCambiar}
      onBlur={() => setTexto(String(valor))}
      aria-label="Cantidad"
      title={`Máximo disponible: ${maximo}`}
    />
  );
}

export default function TicketPanel({
  ticket, resultado, enviando, error, aviso, onCerrar, onConfirmar, onCambiarCliente, onNuevaVenta,
}) {
  const { items, cliente, totales } = ticket;
  const esGenerico = !cliente.id_cliente;
  const etiquetaCliente = esGenerico ? 'Consumidor' : cliente.tipo === 'empresa' ? 'Empresa' : 'Persona natural';
  const etiquetaIva = totales.tarifaUnica !== null ? `IVA general (${totales.tarifaUnica}%)` : 'IVA';

  return (
    <aside className="ticket" aria-label="Ticket de venta">
      <header className="ticket-cabecera">
        <h2><ReceiptText size={20} /> {resultado ? `Ticket ${resultado.ticket}` : 'Nueva venta'}</h2>
        <button className="ticket-cerrar" onClick={onCerrar} aria-label="Cerrar panel"><X size={18} /></button>
      </header>

      {resultado ? (
        <div className="ticket-exito">
          <CircleCheck size={56} />
          <h3>Venta registrada</h3>
          <p className="mono">{resultado.ticket}</p>
          <dl>
            <div><dt>Cliente</dt><dd>{resultado.cliente.nombre_razon_social}</dd></div>
            <div><dt>Forma de pago</dt><dd>{NOMBRE_PAGO[resultado.medioPago]}</dd></div>
            <div><dt>Total</dt><dd className="mono"><Pesos valor={resultado.total} /></dd></div>
            {resultado.cambio !== null && (
              <div><dt>Cambio</dt><dd className="mono"><Pesos valor={resultado.cambio} /></dd></div>
            )}
          </dl>
          <button className="boton-primario" onClick={onNuevaVenta}>Nueva venta</button>
        </div>
      ) : (
        <>
          <section className="ticket-cliente">
            <div className="ticket-etiquetas">
              <span>Cliente facturación</span>
              <span className="azul">{etiquetaCliente}</span>
            </div>
            <div className="cliente-tarjeta">
              <span className="cliente-icono">{cliente.tipo === 'empresa' ? <Building2 size={18} /> : <User size={18} />}</span>
              <div className="cliente-datos">
                <strong>{cliente.nombre_razon_social}</strong>
                <span className="mono">{cliente.tipo_documento}: {cliente.documento}</span>
              </div>
              <button className="boton-suave" onClick={onCambiarCliente}><Pencil size={13} /> Cambiar</button>
            </div>
            {aviso && <div className="alerta-info ticket-aviso">{aviso}</div>}
          </section>

          {items.length === 0 ? (
            <div className="ticket-vacio">
              <ShoppingCart size={32} />
              <span>Agrega productos desde el catálogo</span>
            </div>
          ) : (
            <ul className="ticket-items">
              {items.map(({ producto, cantidad }) => (
                <li className="ticket-item" key={producto.id_producto}>
                  <div className="item-superior">
                    <span className="item-sku mono">{producto.codigo}</span>
                    <button className="boton-icono" onClick={() => ticket.quitar(producto.id_producto)} aria-label={`Quitar ${producto.nombre}`}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="item-nombre">{producto.nombre}</div>
                  <div className="item-unitario mono">Unitario: <Pesos valor={precioConIva(producto)} /></div>
                  <div className="item-inferior">
                    <div className="stepper">
                      <button onClick={() => ticket.cambiarCantidad(producto.id_producto, cantidad - 1)} disabled={cantidad <= 1} aria-label="Restar">
                        <Minus size={14} />
                      </button>
                      <CampoCantidad
                        valor={cantidad}
                        maximo={producto.existencias}
                        onCambio={(n) => ticket.cambiarCantidad(producto.id_producto, n)}
                      />
                      <button onClick={() => ticket.cambiarCantidad(producto.id_producto, cantidad + 1)} disabled={cantidad >= producto.existencias} aria-label="Sumar">
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="item-total mono">{formatoPesos(totalLinea(producto, cantidad))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section className="ticket-resumen">
            <div><span>Subtotal gravable (sin IVA):</span><span className="mono"><Pesos valor={totales.subtotal} /></span></div>
            <div><span>{etiquetaIva}:</span><span className="mono"><Pesos valor={totales.ivaTotal} /></span></div>
            <div>
              <span>
                Descuento comercial:
                <input
                  className="descuento mono"
                  type="number" min="0" max="100" step="1"
                  value={ticket.descuento}
                  onChange={(e) => ticket.setDescuento(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  aria-label="Porcentaje de descuento"
                />%
              </span>
              <span className="mono"><Pesos valor={totales.descuento} /></span>
            </div>
          </section>

          <section className="ticket-total">
            <small>Total a liquidar</small>
            <div>
              <div className="valor mono">{formatoPesos(totales.total)}</div>
              <span className="cop">COP</span>
            </div>
          </section>

          <section className="ticket-pago">
            <span className="pago-titulo">Forma de pago</span>
            <div className="formas-pago">
              {FORMAS_PAGO.map(({ valor, texto, icono: Icono }) => (
                <button key={valor} aria-pressed={ticket.medioPago === valor} className="forma-pago" onClick={() => ticket.setMedioPago(valor)}>
                  <Icono size={18} />
                  {texto}
                </button>
              ))}
            </div>

            <div className="pago-monto">
              <div>
                <span className="etq">Monto recibido</span>
                <label className="monto-entrada">
                  <span>$</span>
                  <input
                    className="mono"
                    inputMode="numeric"
                    placeholder="Opcional"
                    value={ticket.montoRecibido === '' ? '' : formatoNumero(Number(ticket.montoRecibido))}
                    onChange={(e) => ticket.setMontoRecibido(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                </label>
              </div>
              <div>
                <span className="etq">{ticket.montoInsuficiente ? 'Faltan' : 'Cambio / vueltas'}</span>
                <div className={`cambio-valor mono ${ticket.montoInsuficiente ? 'falta' : ''}`}>
                  {ticket.cambio === null ? '—' : <Pesos valor={Math.abs(ticket.cambio)} />}
                </div>
              </div>
            </div>
          </section>

          <div className="ticket-confirmar">
            {error && <div className="alerta-error" role="alert">{error}</div>}
            <button className="boton-primario" onClick={onConfirmar} disabled={!ticket.puedeConfirmar || enviando}>
              <CircleCheck size={18} />
              {enviando ? 'Registrando…' : 'Confirmar venta'}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}