import { formatoCantidad, formatoNumero, formatoPesos } from '../utils/formato';
import { nivelStock } from '../utils/stock';

const PERIODOS = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };


function StockBajo({ datos }) {
  if (datos.productos.length === 0) return null;
  return (
    <div className="chat-tarjeta">
      {datos.productos.map((p, i) => {
        const nivel = nivelStock(p.existencias, p.stock_minimo);
        return (
          <div className="chat-item" key={p.codigo}>
            <div className="chat-item-cab">
              <strong>{i + 1}. {p.nombre}</strong>
              <span className={`chat-etiqueta ${nivel.clase}`}>{nivel.texto}</span>
            </div>
            <div className="chat-item-det mono">
              <span>Stock actual: <b className={nivel.clase}>{formatoCantidad(p.existencias)} und</b></span>
              <span>Reorden: {formatoCantidad(p.stock_minimo)} und</span>
            </div>
          </div>
        );
      })}
      {datos.total > datos.mostrados && <div className="chat-mas">y {datos.total - datos.mostrados} más…</div>}
    </div>
  );
}

function Productos({ datos }) {
  if (datos.productos.length === 0) return null;
  return (
    <div className="chat-tarjeta">
      {datos.productos.map((p) => {
        const nivel = p.activo ? nivelStock(p.existencias, p.stock_minimo) : { texto: 'Desactivado', clase: 'agotado' };
        const precio = Math.round(p.precio_venta_sin_iva * (1 + p.iva_porcentaje / 100));
        return (
          <div className="chat-item" key={p.codigo}>
            <div className="chat-item-cab">
              <strong>{p.nombre}</strong>
              <span className={`chat-etiqueta ${nivel.clase}`}>{nivel.texto}</span>
            </div>
            <div className="chat-item-det mono">
              <span>Stock: <b className={nivel.clase}>{formatoCantidad(p.existencias)} {p.unidad}</b></span>
              <span>{formatoPesos(precio)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Ventas({ datos }) {
  return (
    <div className="chat-tarjeta">
      <div className="chat-item-cab"><strong>Ventas · {PERIODOS[datos.periodo] ?? datos.periodo}</strong></div>
      <div className="chat-stats">
        <div className="chat-stat"><small>Total vendido</small><b className="mono">{formatoPesos(datos.total_vendido)}</b></div>
        <div className="chat-stat"><small>Ventas</small><b className="mono">{formatoNumero(datos.num_ventas)}</b></div>
        <div className="chat-stat"><small>Ticket promedio</small><b className="mono">{formatoPesos(datos.ticket_promedio)}</b></div>
        <div className="chat-stat"><small>Anuladas</small><b className="mono">{formatoNumero(datos.anuladas)}</b></div>
      </div>
    </div>
  );
}

const TARJETAS = {
  productos_stock_bajo: StockBajo,
  buscar_productos: Productos,
  resumen_ventas: Ventas,
  productos_mas_vendidos: MasVendidos,
  historial_cliente: HistorialCliente,
  ventas_por_vendedor: VentasVendedor,
};

const CRITERIOS = { cantidad: 'por unidades', valor: 'por valor vendido' };

function MasVendidos({ datos }) {
  if (datos.productos.length === 0) {
    return <div className="chat-tarjeta"><div className="chat-mas">No hay ventas en este periodo.</div></div>;
  }
  return (
    <div className="chat-tarjeta">
      <div className="chat-titulo">
        Más vendidos · {PERIODOS[datos.periodo] ?? datos.periodo} · {CRITERIOS[datos.criterio]}
      </div>
      {datos.productos.map((p, i) => (
        <div className="chat-item" key={p.id_producto}>
          <div className="chat-item-cab"><strong>{i + 1}. {p.nombre}</strong></div>
          <div className="chat-item-det mono">
            <span>{formatoCantidad(p.unidades)} {p.unidad_medida}</span>
            <span>{formatoPesos(p.total)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistorialCliente({ datos }) {
  if (datos.clientes.length === 0) {
    return <div className="chat-tarjeta"><div className="chat-mas">No encontré clientes con ese dato.</div></div>;
  }
  return (
    <div className="chat-tarjeta">
      {datos.clientes.map((c) => (
        <div className="chat-item" key={c.documento}>
          <div className="chat-item-cab">
            <strong>{c.nombre}</strong>
            <span className="chat-etiqueta normal">{c.tipo}</span>
          </div>
          <div className="chat-item-det mono"><span>{c.documento}</span></div>
          <div className="chat-stats">
            <div className="chat-stat"><small>Total comprado</small><b className="mono">{formatoPesos(c.total_comprado)}</b></div>
            <div className="chat-stat"><small>Compras</small><b className="mono">{formatoNumero(c.num_compras)}</b></div>
          </div>
          {c.ultimas_compras.map((v) => (
            <div className="chat-item-det mono chat-compra" key={v.ticket}>
              <span>{v.ticket} · {v.fecha}</span>
              <span className={v.estado === 'anulada' ? 'tachado' : ''}>{formatoPesos(v.total)}</span>
            </div>
          ))}
        </div>
      ))}
      {datos.hay_mas && <div className="chat-mas">Hay más coincidencias: indica el documento para precisar.</div>}
    </div>
  );
}

function VentasVendedor({ datos }) {
  if (datos.vendedores.length === 0) {
    return <div className="chat-tarjeta"><div className="chat-mas">No hay ventas en este periodo.</div></div>;
  }
  return (
    <div className="chat-tarjeta">
      <div className="chat-titulo">Ventas por vendedor · {PERIODOS[datos.periodo] ?? datos.periodo}</div>
      {datos.vendedores.map((v, i) => (
        <div className="chat-item" key={v.id_usuario}>
          <div className="chat-item-cab">
            <strong>{i + 1}. {v.vendedor}</strong>
            <b className="mono">{formatoPesos(v.total_vendido)}</b>
          </div>
          <div className="chat-item-det mono">
            <span>{formatoNumero(v.num_ventas)} ventas · promedio {formatoPesos(v.ticket_promedio)}</span>
            {v.anuladas > 0 && <span>{v.anuladas} anuladas</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TarjetasChat({ tarjetas = [] }) {
  return tarjetas.map((t, i) => {
    const Tarjeta = TARJETAS[t.herramienta];
    return Tarjeta ? <Tarjeta key={`${t.herramienta}-${i}`} datos={t.datos} /> : null;
  });
}