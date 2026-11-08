import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Eye, TriangleAlert } from 'lucide-react';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { PAGOS } from '../utils/pagos';
import {
  etiquetaDocumento, formatoFecha, formatoHora, formatoNumero, formatoPesos,
} from '../utils/formato';
import Paginacion from '../components/Paginacion';
import DetalleVenta from '../components/DetalleVenta';
import AnularModal from '../components/AnularModal';
import './HistorialVentas.css';

const LIMITE = 10;
const FILTROS_VACIOS = { numero: '', estado: '', medio_pago: '', desde: '', hasta: '' };

export default function HistorialVentas() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === ROLES.ADMIN;

  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [numeroAplicado, setNumeroAplicado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState({ datos: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [seleccionada, setSeleccionada] = useState(null); // id de la venta abierta en el panel
  const [versionDetalle, setVersionDetalle] = useState(0);
  const [anulando, setAnulando] = useState(null); // venta que se está por anular

  const peticion = useRef(0);

  // El número de ticket se aplica 400 ms después de escribir
  useEffect(() => {
    const espera = setTimeout(() => {
      setNumeroAplicado(filtros.numero);
      setPagina(1);
    }, 400);
    return () => clearTimeout(espera);
  }, [filtros.numero]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const espera = setTimeout(() => setMensaje(''), 4000);
    return () => clearTimeout(espera);
  }, [mensaje]);

  const cargarLista = useCallback(async () => {
    const id = ++peticion.current;
    setCargando(true);

    const params = new URLSearchParams({ pagina, limite: LIMITE });
    if (numeroAplicado) params.set('numero', numeroAplicado);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.medio_pago) params.set('medio_pago', filtros.medio_pago);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);

    try {
      const respuesta = await api(`/ventas?${params}`);
      if (id !== peticion.current) return;
      setLista(respuesta);
      setError('');
    } catch (e) {
      if (id === peticion.current) setError(e.message);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [pagina, numeroAplicado, filtros.estado, filtros.medio_pago, filtros.desde, filtros.hasta]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  function cambiar(campo) {
    return (e) => {
      const valor = campo === 'numero' ? e.target.value.replace(/\D/g, '') : e.target.value;
      setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
      if (campo !== 'numero') setPagina(1);
    };
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setNumeroAplicado('');
    setPagina(1);
  }

  function alAnular(texto) {
    setAnulando(null);
    setMensaje(texto);
    cargarLista();
    setVersionDetalle((v) => v + 1); // recarga el panel si la venta anulada está abierta
  }

  const { datos: ventas, total } = lista;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);
  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <div className={`hv ${seleccionada ? 'con-detalle' : ''}`}>
      <span className="hv-chip-modulo">Módulo fiscal y auditoría</span>
      <h1 className="titulo-pagina">Historial de Ventas</h1>

      {mensaje && <div className="alerta-exito" role="status">{mensaje}</div>}
      {error && (
        <div className="alerta-error" role="alert">
          {error} <button className="enlace" onClick={cargarLista}>Reintentar</button>
        </div>
      )}

      <div className="hv-filtros">
        <label>
          <span>N.º ticket</span>
          <input inputMode="numeric" placeholder="Ej: 892" value={filtros.numero} onChange={cambiar('numero')} />
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="">Todos</option>
            <option value="activa">Activa</option>
            <option value="anulada">Anulada</option>
          </select>
        </label>
        <label>
          <span>Forma de pago</span>
          <select value={filtros.medio_pago} onChange={cambiar('medio_pago')}>
            <option value="">Todas</option>
            {Object.entries(PAGOS).map(([valor, { texto }]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} />
        </label>
        {hayFiltros && <button className="enlace hv-limpiar" onClick={limpiarFiltros}>Limpiar filtros</button>}
      </div>

      <div className="hv-caja">
        <div className="hv-cabecera-tabla">
          <h2>
            Transacciones registradas
            <span className="hv-chip-total">{formatoNumero(total)} resultados</span>
          </h2>
          <span>Mostrando {inicio} - {fin} de {formatoNumero(total)}</span>
        </div>

        <div className={`hv-envoltorio ${cargando ? 'actualizando' : ''}`}>
          <table className="hv-tabla">
            <thead>
              <tr>
                <th>N.º ticket</th>
                <th>Fecha / hora</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Medio de pago</th>
                <th className="der">Total (COP)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => {
                const anulada = v.estado === 'anulada';
                const pago = PAGOS[v.medio_pago];
                const IconoPago = pago.icono;
                return (
                  <tr
                    key={v.id_venta}
                    className={`hv-fila ${anulada ? 'anulada' : ''} ${seleccionada === v.id_venta ? 'seleccionada' : ''}`}
                    onClick={() => setSeleccionada(v.id_venta)}
                  >
                    <td className={`hv-ticket mono ${anulada ? 'rojo' : ''}`}>
                      {anulada && <TriangleAlert size={13} />}
                      {v.ticket}
                    </td>
                    <td>
                      <div className="hv-fecha">{formatoFecha(v.fecha_hora)}</div>
                      <div className="hv-hora mono">{formatoHora(v.fecha_hora)}</div>
                    </td>
                    <td>
                      <div className="hv-cliente">{v.cliente}</div>
                      <div className="hv-doc mono">{etiquetaDocumento(v.tipo_documento)}: {v.documento}</div>
                    </td>
                    <td>{v.vendedor}</td>
                    <td><span className="hv-pago"><IconoPago size={13} /> {pago.texto}</span></td>
                    <td className={`der hv-total mono ${anulada ? 'tachado' : ''}`}>{formatoPesos(v.total)}</td>
                    <td><span className={`hv-estado ${anulada ? 'anulada' : 'activa'}`}>{anulada ? 'Anulada' : 'Activa'}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="hv-acciones">
                        <button
                          className={`boton-icono ${seleccionada === v.id_venta ? 'hv-ojo-activo' : ''}`}
                          onClick={() => setSeleccionada(v.id_venta)}
                          title="Ver detalle" aria-label={`Ver detalle del ticket ${v.ticket}`}
                        >
                          <Eye size={18} />
                        </button>
                        {esAdmin && !anulada && (
                          <button
                            className="boton-icono hv-anular" onClick={() => setAnulando(v)}
                            title="Anular venta" aria-label={`Anular el ticket ${v.ticket}`}
                          >
                            <Ban size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!cargando && ventas.length === 0 && !error && (
            <div className="hv-vacio">No hay ventas que coincidan con los filtros.</div>
          )}
        </div>

        <footer className="hv-pie">
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
        </footer>
      </div>

      {seleccionada && (
        <DetalleVenta
          key={seleccionada}
          id={seleccionada}
          version={versionDetalle}
          onCerrar={() => setSeleccionada(null)}
        />
      )}

      {anulando && (
        <AnularModal venta={anulando} onCerrar={() => setAnulando(null)} onAnulada={alAnular} />
      )}
    </div>
  );
}