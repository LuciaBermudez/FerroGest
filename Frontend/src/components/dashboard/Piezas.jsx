import { Banknote } from 'lucide-react';
import { formatoCantidad, formatoCorto, formatoNumero, formatoPesos } from '../../utils/formato';

export function Pesos({ valor }) {
  return (
    <>
      {formatoPesos(valor)}
      <span className="moneda">COP</span>
    </>
  );
}

export function TarjetaDinero({ etiqueta, valor, icono: Icono, alerta = false }) {
  return (
    <div className={`tarjeta ${alerta ? 'tarjeta-alerta' : ''}`}>
      <p className="tarjeta-etiqueta">{etiqueta}</p>
      <p className="tarjeta-valor"><Pesos valor={valor} /></p>
      {Icono && <span className="tarjeta-icono"><Icono size={18} /></span>}
    </div>
  );
}

export function TarjetaCifra({ etiqueta, valor, unidad, icono: Icono, alerta = false }) {
  return (
    <div className={`tarjeta ${alerta ? 'tarjeta-alerta' : ''}`}>
      <p className="tarjeta-etiqueta">{etiqueta}</p>
      <p className="tarjeta-valor">
        {formatoNumero(valor)}
        {unidad && <span className="valor-unidad">{unidad}</span>}
      </p>
      {Icono && <span className="tarjeta-icono"><Icono size={18} /></span>}
    </div>
  );
}

export function TarjetaTotal({ etiqueta = 'Total', valor }) {
  return (
    <div className="tarjeta tarjeta-total">
      <p className="tarjeta-etiqueta">{etiqueta}</p>
      <p className="tarjeta-valor"><Pesos valor={valor} /></p>
    </div>
  );
}

// Tarjeta ancha con icono grande: tono "azul", "rojo" o "ambar"
export function TarjetaFila({ etiqueta, valor, nota, icono: Icono, tono = 'azul' }) {
  return (
    <div className="tarjeta tarjeta-fila">
      <div>
        <p className="tarjeta-etiqueta">{etiqueta}</p>
        <p className={`tarjeta-valor ${tono === 'azul' ? '' : tono}`}>{formatoNumero(valor)}</p>
        {nota && <small className="tarjeta-nota">{nota}</small>}
      </div>
      <span className={`icono-grande ${tono}`}><Icono size={22} /></span>
    </div>
  );
}

export function TarjetaEfectivoDigital({ medios }) {
  return (
    <div className="tarjeta">
      <p className="tarjeta-etiqueta"><Banknote size={14} /> Efectivo vs digitales</p>
      <div className="barra-etiquetas">
        <span>Efectivo: {medios.porcentaje_efectivo}%</span>
        <span>Digital: {medios.porcentaje_digital}%</span>
      </div>
      <div className="barra">
        <div className="barra-efectivo" style={{ width: `${medios.porcentaje_efectivo}%` }} />
        <div className="barra-digital" style={{ width: `${medios.porcentaje_digital}%` }} />
      </div>
      <div className="leyenda">
        <span><i className="punto" style={{ background: 'var(--azul-oscuro)' }} />Efec. {formatoCorto(medios.efectivo)}</span>
        <span><i className="punto" style={{ background: '#3b82f6' }} />Dig. {formatoCorto(medios.digital)}</span>
      </div>
    </div>
  );
}

export function TopProductos({ titulo, top }) {
  return (
    <section className="tarjeta top5">
      <div className="top-cabecera">
        <div>
          <h2>{titulo}</h2>
          <p>Artículos con mayor impacto en ventas</p>
        </div>
        <div className="total-generado">
          Total generado: <strong>{formatoCorto(top.total_generado)}</strong>
        </div>
      </div>

      {top.productos.length === 0 ? (
        <p className="texto-suave">Aún no hay ventas en este periodo.</p>
      ) : (
        top.productos.map((p, i) => (
          <div className="top-fila" key={p.id_producto}>
            <div className="top-producto">
              <span className={`top-rango ${i < 3 ? 'destacado' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
              <span>{p.nombre}</span>
            </div>
            <span className="top-sku">{p.codigo}</span>
            <span className="top-unidades">{formatoCantidad(p.unidades)} {p.unidad_medida}</span>
            <span className="top-total">{formatoPesos(p.total)}<span className="moneda">COP</span></span>
          </div>
        ))
      )}
    </section>
  );
}