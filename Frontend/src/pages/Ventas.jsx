import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Plus, Search, SquarePlus } from 'lucide-react';
import { api } from '../api/cliente';
import { CLIENTE_GENERICO, useTicket } from '../hooks/useTicket';
import { formatoCantidad, formatoPesos } from '../utils/formato';
import { precioConIva } from '../utils/venta';
import TicketPanel from '../components/TicketPanel';
import ClienteModal from '../components/ClienteModal';
import './Ventas.css';

const LIMITE = 10;
const UBICACION_PLACEHOLDER = 'Ubicación por definir'; // la ubicación no está en la base de datos

export default function Ventas() {
  const ticket = useTicket();

  // Catálogo
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [catalogo, setCatalogo] = useState({ datos: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Venta en curso
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [avisoCliente, setAvisoCliente] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');
  const [resultado, setResultado] = useState(null);

  const peticion = useRef(0);

  useEffect(() => {
    api('/categorias').then(setCategorias).catch(() => {});
  }, []);

  // Espera 300 ms después de escribir antes de buscar
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  const cargarCatalogo = useCallback(async () => {
    const id = ++peticion.current;
    setCargando(true);

    const params = new URLSearchParams({ activo: 'true', pagina, limite: LIMITE });
    if (busquedaAplicada) params.set('buscar', busquedaAplicada);
    if (categoria) params.set('categoria', categoria);

    try {
      const respuesta = await api(`/productos?${params}`);
      if (id !== peticion.current) return; // llegó una petición más reciente
      setCatalogo(respuesta);
      setError('');
    } catch (e) {
      if (id === peticion.current) setError(e.message);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [pagina, busquedaAplicada, categoria]);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  function reiniciarVenta() {
    ticket.reiniciar();
    setResultado(null);
    setErrorVenta('');
    setAvisoCliente('');
  }

  function abrirPanel() {
    if (resultado) reiniciarVenta(); // si se acaba de cobrar, empieza una venta nueva
    setPanelAbierto(true);
  }

  function cerrarPanel() {
    if (resultado) reiniciarVenta();
    setPanelAbierto(false);
  }

  function agregarProducto(producto) {
    if (!(producto.existencias > 0)) {
      setAviso(`"${producto.nombre}" no tiene stock disponible`);
      return;
    }
    setAviso('');
    if (resultado) reiniciarVenta();
    ticket.agregar(producto);
    setPanelAbierto(true);
  }

  // Lector de código de barras: escribe el código y envía Enter
  async function buscarPorCodigo(evento) {
    if (evento.key !== 'Enter') return;
    const texto = busqueda.trim();
    if (!texto) return;

    try {
      const r = await api(`/productos?activo=true&buscar=${encodeURIComponent(texto)}&limite=5`);
      const exacto =
        r.datos.find((p) => p.codigo.toLowerCase() === texto.toLowerCase()) ??
        (r.datos.length === 1 ? r.datos[0] : null);

      if (exacto) {
        agregarProducto(exacto);
        setBusqueda('');
      } else {
        setAviso(`No se encontró un único producto para "${texto}"`);
      }
    } catch (e) {
      setAviso(e.message);
    }
  }

  async function confirmar() {
    setEnviando(true);
    setErrorVenta('');

    const cuerpo = {
      medio_pago: ticket.medioPago,
      porcentaje_descuento: ticket.descuento,
      items: ticket.items.map((i) => ({ id_producto: i.producto.id_producto, cantidad: i.cantidad })),
    };
    if (ticket.cliente.id_cliente) cuerpo.id_cliente = ticket.cliente.id_cliente;
    if (ticket.recibido !== null) cuerpo.monto_recibido = ticket.recibido;

    try {
      const respuesta = await api('/ventas', { metodo: 'POST', cuerpo });
      setResultado({
        ...respuesta,
        cliente: ticket.cliente,
        medioPago: ticket.medioPago,
        cambio: ticket.recibido !== null ? ticket.recibido - respuesta.total : null,
      });
    } catch (e) {
      setErrorVenta(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setEnviando(false);
      cargarCatalogo(); // el stock cambió (o el error indica que ya estaba desactualizado)
    }
  }

  const { datos: productos, total } = catalogo;
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);

  return (
    <div className={`ventas ${panelAbierto ? 'con-panel' : ''}`}>
      <button className="boton-registrar" onClick={abrirPanel}>
        <SquarePlus size={18} />
        Registrar Venta
        {!resultado && ticket.items.length > 0 && <span className="insignia">{ticket.items.length}</span>}
      </button>

      <div className="ventas-filtros">
        <div className="busqueda">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar por código de barras (EAN), SKU o nombre del producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={buscarPorCodigo}
          />
        </div>
        <div className="categorias" role="group" aria-label="Categorías">
          <button className={categoria === '' ? 'activo' : ''} onClick={() => { setCategoria(''); setPagina(1); }}>Todos</button>
          {categorias.map((c) => (
            <button
              key={c.id_categoria}
              className={String(c.id_categoria) === String(categoria) ? 'activo' : ''}
              onClick={() => { setCategoria(c.id_categoria); setPagina(1); }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      {aviso && <div className="alerta-info">{aviso}</div>}
      {error && (
        <div className="alerta-error" role="alert">
          {error} <button className="enlace" onClick={cargarCatalogo}>Reintentar</button>
        </div>
      )}

      <section className="catalogo">
        <h2 className="catalogo-titulo"><ClipboardList size={16} /> Catálogo local de mostrador</h2>

        <div className={`tabla-envoltorio ${cargando ? 'actualizando' : ''}`}>
          <table className="tabla-catalogo">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto / especificación</th>
                <th>Categoría</th>
                <th className="derecha">Stock disponible</th>
                <th className="derecha">Precio unitario</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const sinStock = !(p.existencias > 0);
                return (
                  <tr key={p.id_producto} className={sinStock ? 'fila-agotada' : ''}>
                    <td className="celda-sku mono">{p.codigo}</td>
                    <td>
                      <div className="prod-nombre">{p.nombre}</div>
                      {p.descripcion && <div className="prod-desc">{p.descripcion}</div>}
                    </td>
                    <td><span className="etiqueta">{p.categoria}</span></td>
                    <td className="derecha">
                      <div className={`mono stock ${sinStock ? 'agotado' : ''}`}>
                        {sinStock ? 'Agotado' : `${formatoCantidad(p.existencias)} ${p.unidad_medida}`}
                      </div>
                      <div className="ubicacion">{UBICACION_PLACEHOLDER}</div>
                    </td>
                    <td className="derecha celda-precio mono">{formatoPesos(precioConIva(p))}</td>
                    <td>
                      <button className="boton-agregar" disabled={sinStock} onClick={() => agregarProducto(p)}>
                        <Plus size={14} /> Agregar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!cargando && productos.length === 0 && !error && (
            <div className="vacio">No hay productos que coincidan con la búsqueda.</div>
          )}
        </div>

        <footer className="catalogo-pie">
          <span>Mostrando {inicio} - {fin} de {total} productos</span>
          <div className="paginacion">
            <button onClick={() => setPagina((p) => p - 1)} disabled={pagina <= 1}>Anterior</button>
            <button onClick={() => setPagina((p) => p + 1)} disabled={fin >= total}>Siguiente</button>
          </div>
        </footer>
      </section>

      {panelAbierto && (
        <TicketPanel
          ticket={ticket}
          resultado={resultado}
          enviando={enviando}
          error={errorVenta}
          aviso={avisoCliente}
          onCerrar={cerrarPanel}
          onConfirmar={confirmar}
          onCambiarCliente={() => setModalCliente(true)}
          onNuevaVenta={reiniciarVenta}
        />
      )}

      {modalCliente && (
        <ClienteModal
          onCerrar={() => setModalCliente(false)}
          onGenerico={() => {
            ticket.setCliente(CLIENTE_GENERICO);
            setAvisoCliente('');
            setModalCliente(false);
          }}
          onUsar={(cliente, { yaExistia }) => {
            ticket.setCliente(cliente);
            setAvisoCliente(yaExistia ? `Ya existía un cliente con ese documento: se usará "${cliente.nombre_razon_social}".` : '');
            setModalCliente(false);
          }}
        />
      )}
    </div>
  );
}