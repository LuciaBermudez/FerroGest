import { useEffect, useState } from 'react';
import {
  Banknote, Building2, CalendarDays, CircleX, Receipt, ShoppingCart, TrendingUp, TriangleAlert, User,
} from 'lucide-react';
import { api } from '../api/cliente';
import { fechaLarga, formatoCantidad, formatoCorto, formatoNumero, formatoPesos, nombreMes } from '../utils/formato';
import './Dashboard.css';

const PERIODOS = [
  { valor: 'hoy', texto: 'Hoy', titulo: 'Top 5 de Hoy' },
  { valor: 'semana', texto: 'Esta Semana', titulo: 'Top 5 de la Semana' },
  { valor: 'mes', texto: 'Este Mes', titulo: 'Top 5 del Mes' },
];

function Pesos({ valor }) {
  return (
    <>
      {formatoPesos(valor)}
      <span className="moneda">COP</span>
    </>
  );
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('hoy');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true; // evita que una respuesta lenta pise a una más reciente
    setCargando(true);
    setError('');

    api(`/dashboard?periodo=${periodo}`)
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [periodo, intento]);

  const periodoActual = PERIODOS.find((p) => p.valor === periodo);

  return (
    <div>
      <div className="dashboard-cabecera">
        <h1 className="titulo-pagina">Dashboard</h1>
        <div className="selector" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              className={p.valor === periodo ? 'activo' : ''}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="fecha">
        <CalendarDays size={18} />
        {fechaLarga()}
      </div>

      {error && (
        <div className="alerta-error" role="alert">
          {error}{' '}
          <button className="enlace" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {!datos && cargando && <p className="texto-suave">Cargando datos…</p>}

      {datos && (
        <div className={cargando ? 'actualizando' : ''}>
          <div className="rejilla rejilla-4">
            <div className="tarjeta">
              <p className="tarjeta-etiqueta">Ventas del día (hoy)</p>
              <p className="tarjeta-valor"><Pesos valor={datos.ventas_hoy.total} /></p>
              <span className="tarjeta-icono"><ShoppingCart size={18} /></span>
            </div>

            <div className="tarjeta">
              <p className="tarjeta-etiqueta">Ventas del mes ({nombreMes()})</p>
              <p className="tarjeta-valor"><Pesos valor={datos.ventas_mes.total} /></p>
              <span className="tarjeta-icono"><TrendingUp size={18} /></span>
            </div>

            <div className="tarjeta tarjeta-alerta">
              <p className="tarjeta-etiqueta">Stock bajo y crítico</p>
              <p className="tarjeta-valor">
                {formatoNumero(datos.stock.total)}
                <span className="valor-unidad">referencias</span>
              </p>
              <span className="tarjeta-icono"><TriangleAlert size={18} /></span>
            </div>

            <div className="tarjeta tarjeta-total">
              <p className="tarjeta-etiqueta">Total</p>
              <p className="tarjeta-valor"><Pesos valor={datos.resumen.total_vendido} /></p>
            </div>
          </div>

          <div className="rejilla rejilla-3">
            <div className="tarjeta">
              <p className="tarjeta-etiqueta">Ticket promedio</p>
              <p className="tarjeta-valor"><Pesos valor={datos.resumen.ticket_promedio} /></p>
              <span className="tarjeta-icono"><Receipt size={18} /></span>
            </div>

            <div className="tarjeta tarjeta-alerta">
              <p className="tarjeta-etiqueta">Comprobantes anulados</p>
              <p className="tarjeta-valor">{formatoNumero(datos.resumen.anuladas)}</p>
              <span className="tarjeta-icono"><CircleX size={18} /></span>
            </div>

            <div className="tarjeta">
              <p className="tarjeta-etiqueta"><Banknote size={14} /> Efectivo vs digitales</p>
              <div className="barra-etiquetas">
                <span>Efectivo: {datos.medios_pago.porcentaje_efectivo}%</span>
                <span>Digital: {datos.medios_pago.porcentaje_digital}%</span>
              </div>
              <div className="barra">
                <div className="barra-efectivo" style={{ width: `${datos.medios_pago.porcentaje_efectivo}%` }} />
                <div className="barra-digital" style={{ width: `${datos.medios_pago.porcentaje_digital}%` }} />
              </div>
              <div className="leyenda">
                <span><i className="punto" style={{ background: 'var(--azul-oscuro)' }} />Efec. {formatoCorto(datos.medios_pago.efectivo)}</span>
                <span><i className="punto" style={{ background: '#3b82f6' }} />Dig. {formatoCorto(datos.medios_pago.digital)}</span>
              </div>
            </div>
          </div>

          <div className="rejilla rejilla-2">
            <div className="tarjeta tarjeta-fila">
              <div>
                <p className="tarjeta-etiqueta">Personas naturales</p>
                <p className="tarjeta-valor">{formatoNumero(datos.clientes.personas_naturales)}</p>
              </div>
              <span className="icono-grande"><User size={22} /></span>
            </div>
            <div className="tarjeta tarjeta-fila">
              <div>
                <p className="tarjeta-etiqueta">Empresas (NIT)</p>
                <p className="tarjeta-valor">{formatoNumero(datos.clientes.empresas)}</p>
              </div>
              <span className="icono-grande"><Building2 size={22} /></span>
            </div>
          </div>

          <section className="tarjeta top5">
            <div className="top-cabecera">
              <div>
                <h2>{periodoActual.titulo}</h2>
                <p>Artículos con mayor impacto en ventas</p>
              </div>
              <div className="total-generado">
                Total generado: <strong>{formatoCorto(datos.top_productos.total_generado)}</strong>
              </div>
            </div>

            {datos.top_productos.productos.length === 0 ? (
              <p className="texto-suave">Aún no hay ventas en este periodo.</p>
            ) : (
              datos.top_productos.productos.map((p, i) => (
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
        </div>
      )}
    </div>
  );
}