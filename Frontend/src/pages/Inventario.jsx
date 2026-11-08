import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban, BrickWall, CircleCheck, CircleDot, Droplet, EyeOff, Hammer, Package, PaintBucket,
  Pencil, Search, Shapes, SquarePlus, TriangleAlert, Warehouse, Wrench, Zap,
} from 'lucide-react';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { formatoCantidad, formatoNumero, formatoPesos } from '../utils/formato';
import { precioConIva } from '../utils/venta';
import Paginacion from '../components/Paginacion';
import ProductoAside from '../components/ProductoAside';
import EntradaModal from '../components/EntradaModal';
import './Inventario.css';

const LIMITE = 8;

const ESTADOS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'bajo', texto: 'Bajo mínimo' },
];

const KPIS = [
  { clave: 'total', etiqueta: 'Total referencias', icono: Shapes, tono: 'neutro' },
  { clave: 'activos', etiqueta: 'Artículos activos', icono: CircleCheck, tono: 'azul' },
  { clave: 'bajo', etiqueta: 'Bajo stock mínimo', icono: TriangleAlert, tono: 'rojo' },
  { clave: 'desactivados', etiqueta: 'Desactivados', icono: EyeOff, tono: 'gris' },
];

// Ícono según el nombre de la categoría
function iconoCategoria(nombre = '') {
  const n = nombre.toLowerCase();
  if (n.includes('eléctric') || n.includes('electric')) return Zap;
  if (n.includes('fontaner')) return Droplet;
  if (n.includes('obra')) return BrickWall;
  if (n.includes('fijaci')) return Hammer;
  if (n.includes('pintur')) return PaintBucket;
  if (n.includes('abrasiv')) return CircleDot;
  if (n.includes('manual')) return Wrench;
  return Package;
}

export default function Inventario() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === ROLES.ADMIN;

  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);

  const [categorias, setCategorias] = useState([]);
  const [lista, setLista] = useState({ datos: [], total: 0 });
  const [resumen, setResumen] = useState({ total: 0, activos: 0, bajo: 0, desactivados: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [aside, setAside] = useState(null); // { producto } — producto null = nuevo
  const [modalEntrada, setModalEntrada] = useState(false);

  const peticion = useRef(0);

  useEffect(() => {
    api('/categorias').then(setCategorias).catch(() => {});
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const espera = setTimeout(() => setMensaje(''), 4000);
    return () => clearTimeout(espera);
  }, [mensaje]);

  const cargarLista = useCallback(async () => {
    const id = ++peticion.current;
    setCargando(true);

    const params = new URLSearchParams({ pagina, limite: LIMITE });
    if (busquedaAplicada) params.set('buscar', busquedaAplicada);
    if (categoria) params.set('categoria', categoria);
    // Normal y Bajo mínimo solo cuentan productos activos (los desactivados no se reponen)
    if (estado !== 'todos') {
      params.set('estado', estado);
      params.set('activo', 'true');
    }

    try {
      const respuesta = await api(`/productos?${params}`);
      if (id !== peticion.current) return;
      setLista(respuesta);
      setError('');
    } catch (e) {
      if (id === peticion.current) setError(e.message);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [pagina, busquedaAplicada, categoria, estado]);

  // Las 4 tarjetas: cada una es una consulta de una sola fila (limite=1) que devuelve el total
  const cargarResumen = useCallback(async () => {
    const total = (filtro) => api(`/productos?limite=1${filtro}`).then((r) => r.total);
    try {
      const [todos, activos, bajo, desactivados] = await Promise.all([
        total(''),
        total('&activo=true'),
        total('&activo=true&estado=bajo'),
        total('&activo=false'),
      ]);
      setResumen({ total: todos, activos, bajo, desactivados });
    } catch {
      /* si falla, las tarjetas conservan el último valor */
    }
  }, []);

  useEffect(() => { cargarLista(); }, [cargarLista]);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  function recargar() {
    cargarLista();
    cargarResumen();
  }

  function alGuardar(texto) {
    setAside(null);
    setMensaje(texto);
    recargar();
  }

  function alRegistrarEntrada(texto) {
    setModalEntrada(false);
    setMensaje(texto);
    recargar();
  }

  async function alternarEstado(p) {
    const nuevo = !p.activo;
    const pregunta = nuevo
      ? `¿Activar "${p.nombre}"?`
      : `¿Desactivar "${p.nombre}"? Dejará de aparecer en el catálogo de ventas.`;
    if (!window.confirm(pregunta)) return;

    try {
      await api(`/productos/${p.id_producto}/estado`, { metodo: 'PATCH', cuerpo: { activo: nuevo } });
      setMensaje(`Producto "${p.nombre}" ${nuevo ? 'activado' : 'desactivado'}`);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const { datos: productos, total } = lista;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);

  return (
    <div>
      <div className="inv-cabecera">
        <div>
          <p className="inv-eyebrow"><Warehouse size={15} /> Gestión operativa de almacén</p>
          <h1 className="titulo-pagina">Control de Inventario</h1>
        </div>
        <div className="inv-botones">
          <button className="boton-secundario inv-boton" onClick={() => setAside({ producto: null })}>
            <SquarePlus size={18} /> Nuevo producto
          </button>
          <button className="inv-boton-principal" onClick={() => setModalEntrada(true)}>
            <SquarePlus size={18} /> Registrar Entrada
          </button>
        </div>
      </div>

      {mensaje && <div className="alerta-exito" role="status">{mensaje}</div>}
      {error && (
        <div className="alerta-error" role="alert">
          {error} <button className="enlace" onClick={() => { setError(''); recargar(); }}>Reintentar</button>
        </div>
      )}

      <div className="inv-filtros">
        <div className="inv-busqueda">
          <Search size={18} />
          <input
            type="search" placeholder="Buscar SKU, código de barras o nombre…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <label className="inv-select">
          <Shapes size={16} />
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setPagina(1); }} aria-label="Categoría">
            <option value="">Todas las categorías ({categorias.length})</option>
            {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
          </select>
        </label>

        <div className="inv-segmentos" role="group" aria-label="Estado del stock">
          {ESTADOS.map((e) => (
            <button
              key={e.valor}
              className={`${estado === e.valor ? 'activo' : ''} ${e.valor === 'bajo' ? 'bajo' : ''}`}
              onClick={() => { setEstado(e.valor); setPagina(1); }}
            >
              {e.valor === 'bajo' && <i className="inv-punto-rojo" />}
              {e.texto}
              {e.valor === 'bajo' && ` (${formatoNumero(resumen.bajo)})`}
            </button>
          ))}
        </div>
      </div>

      <div className="inv-caja">
        <div className={`inv-tabla-envoltorio ${cargando ? 'actualizando' : ''}`}>
          <table className="inv-tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre / especificación técnica</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th className="inv-der">Precio de venta</th>
                <th>IVA</th>
                <th className="inv-der">Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const Icono = iconoCategoria(p.categoria);
                const critico = p.existencias <= p.stock_minimo;
                return (
                  <tr key={p.id_producto} className={p.activo ? '' : 'inv-fila-inactiva'}>
                    <td><span className="inv-sku mono">{p.codigo}</span></td>
                    <td>
                      <div className="inv-prod">
                        <span className="inv-prod-icono"><Icono size={16} /></span>
                        <div>
                          <div className="inv-prod-titulo">{p.nombre}</div>
                          {p.descripcion && <div className="inv-prod-sub">{p.descripcion}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="inv-etiqueta">{p.categoria}</span></td>
                    <td className="mono">{p.unidad_medida}</td>
                    <td className="inv-der inv-precio mono">{formatoPesos(precioConIva(p))}</td>
                    <td><span className="inv-iva mono">{p.porcentaje_iva === 0 ? '0% Exento' : `${p.porcentaje_iva}%`}</span></td>
                    <td className="inv-der">
                      <div className={`inv-stock-valor mono ${critico ? 'critico' : ''}`}>{formatoCantidad(p.existencias)}</div>
                      <div className="inv-stock-min mono">Mín: {formatoCantidad(p.stock_minimo)}</div>
                    </td>
                    <td>
                      <span className={`inv-estado ${p.activo ? 'activo' : 'inactivo'}`}>
                        {p.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td>
                      <div className="inv-acciones">
                        <button className="boton-icono inv-editar" onClick={() => setAside({ producto: p })} title="Editar" aria-label={`Editar ${p.nombre}`}>
                          <Pencil size={18} />
                        </button>
                        <button
                          className={`boton-icono ${p.activo ? 'inv-baja' : 'inv-alta'}`}
                          onClick={() => alternarEstado(p)}
                          title={p.activo ? 'Desactivar' : 'Activar'}
                          aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`}
                        >
                          {p.activo ? <Ban size={18} /> : <CircleCheck size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!cargando && productos.length === 0 && !error && (
            <div className="inv-vacio">No hay productos que coincidan con los filtros.</div>
          )}
        </div>

        <footer className="inv-pie">
          <span className="inv-nota">
            <i className="inv-punto-azul" />
            {esAdmin ? (
              <span>Sesión con privilegios: <strong>Modo Administrador Completo</strong> (costos y edición directa autorizados)</span>
            ) : (
              <span>Sesión de <strong>{usuario.rol}</strong>: los costos de compra solo los ve el administrador</span>
            )}
          </span>
          <span>Mostrando {inicio} - {fin} de {formatoNumero(total)} artículos</span>
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
        </footer>
      </div>

      <div className="inv-kpis">
        {KPIS.map(({ clave, etiqueta, icono: Icono, tono }) => (
          <div className="inv-kpi" key={clave}>
            <div>
              <small>{etiqueta}</small>
              <strong className={`mono ${tono}`}>{formatoNumero(resumen[clave])}</strong>
            </div>
            <span className={`inv-kpi-icono ${tono}`}><Icono size={20} /></span>
          </div>
        ))}
      </div>

      {aside && (
        <ProductoAside
          producto={aside.producto}
          categorias={categorias}
          esAdmin={esAdmin}
          onCerrar={() => setAside(null)}
          onGuardado={alGuardar}
          onCategoriaCreada={(nueva) =>
            setCategorias((actuales) => [...actuales, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
          }
        />
      )}

      {modalEntrada && <EntradaModal onCerrar={() => setModalEntrada(false)} onRegistrada={alRegistrarEntrada} />}
    </div>
  );
}