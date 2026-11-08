import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Search, UserPlus } from 'lucide-react';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { etiquetaDocumento, formatoDocumento, formatoNumero } from '../utils/formato';
import Paginacion from '../components/Paginacion';
import ClienteForm from '../components/ClienteForm';
import ClienteDetalle from '../components/ClienteDetalle';
import './Clientes.css';

const LIMITE = 8;

export default function Clientes() {
  const { usuario } = useAuth();
  const esAdmin = usuario.rol === ROLES.ADMIN;
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);

  const [lista, setLista] = useState({ datos: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const [seleccionado, setSeleccionado] = useState(null); // id del cliente abierto debajo de la tabla
  const [versionDetalle, setVersionDetalle] = useState(0);
  const [formulario, setFormulario] = useState(null); // { cliente } — cliente null = nuevo

  const peticion = useRef(0);
  const detalleRef = useRef(null);

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

  // Al elegir un cliente, la página baja hasta su detalle
  useEffect(() => {
    if (seleccionado) detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [seleccionado]);

  const cargarLista = useCallback(async () => {
    const id = ++peticion.current;
    setCargando(true);

    const params = new URLSearchParams({ pagina, limite: LIMITE });
    if (busquedaAplicada) params.set('buscar', busquedaAplicada);
    if (tipo) params.set('tipo', tipo);
    if (estado) params.set('activo', estado);

    try {
      const respuesta = await api(`/clientes?${params}`);
      if (id !== peticion.current) return;
      setLista(respuesta);
      setError('');
    } catch (e) {
      if (id === peticion.current) setError(e.message);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [pagina, busquedaAplicada, tipo, estado]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  function alGuardar(texto, idCliente) {
    setFormulario(null);
    setMensaje(texto);
    setSeleccionado(idCliente);
    setVersionDetalle((v) => v + 1);
    cargarLista();
  }

  function alCambiarEstado(texto) {
    setMensaje(texto);
    setVersionDetalle((v) => v + 1);
    cargarLista();
  }

  const { datos: clientes, total } = lista;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);

  return (
    <div>
      <div className="cl-cabecera">
        <div>
          <h1 className="titulo-pagina">Clientes</h1>
          <p className="cl-descripcion">
            Gestión tributaria, historial de facturación consolidada y perfiles de crédito comercial.
          </p>
        </div>
        <button className="cl-boton-nuevo" onClick={() => setFormulario({ cliente: null })}>
          <UserPlus size={18} /> Nuevo cliente
        </button>
      </div>

      {mensaje && <div className="alerta-exito" role="status">{mensaje}</div>}
      {error && (
        <div className="alerta-error" role="alert">
          {error} <button className="enlace" onClick={cargarLista}>Reintentar</button>
        </div>
      )}

      <div className="cl-filtros">
        <div className="cl-busqueda">
          <Search size={18} />
          <input
            type="search" placeholder="Buscar por nombre, razón social o documento…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }} aria-label="Tipo de cliente">
          <option value="">Todos los tipos</option>
          <option value="persona_natural">Personas naturales</option>
          <option value="empresa">Empresas</option>
        </select>
        <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <div className="cl-caja">
        <div className={`cl-envoltorio ${cargando ? 'actualizando' : ''}`}>
          <table className="cl-tabla">
            <thead>
              <tr>
                <th>Nombre o razón social</th>
                <th>Tipo</th>
                <th>Documento / NIT</th>
                <th>Teléfono / móvil</th>
                <th>Correo electrónico</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id_cliente}
                  className={`cl-fila ${c.id_cliente === seleccionado ? 'seleccionada' : ''} ${c.activo ? '' : 'inactiva'}`}
                >
                  <td className="cl-nombre">{c.nombre_razon_social}</td>
                  <td><span className="cl-tipo">{c.tipo === 'empresa' ? 'Empresa' : 'Persona natural'}</span></td>
                  <td>
                    <span className="cl-doc mono">
                      {etiquetaDocumento(c.tipo_documento)}: {formatoDocumento(c.tipo_documento, c.documento)}
                    </span>
                  </td>
                  <td className="mono cl-tel">{c.telefono || '—'}</td>
                  <td className="cl-correo">{c.correo || '—'}</td>
                  <td><span className={`cl-estado ${c.activo ? 'activo' : 'inactivo'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="cl-acciones">
                      <button
                        className={`boton-icono ${c.id_cliente === seleccionado ? 'cl-ojo-activo' : ''}`}
                        onClick={() => setSeleccionado(c.id_cliente)}
                        title="Ver detalle" aria-label={`Ver detalle de ${c.nombre_razon_social}`}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="boton-icono" onClick={() => setFormulario({ cliente: c })}
                        title="Editar" aria-label={`Editar a ${c.nombre_razon_social}`}
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!cargando && clientes.length === 0 && !error && (
            <div className="cl-vacio">No hay clientes que coincidan con la búsqueda.</div>
          )}
        </div>

        <footer className="cl-pie">
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
          <span>Mostrando {inicio} - {fin} de {formatoNumero(total)} clientes</span>
        </footer>
      </div>

      {seleccionado && (
        <div ref={detalleRef} className="cl-detalle-ancla">
          <ClienteDetalle
            key={seleccionado}
            id={seleccionado}
            version={versionDetalle}
            esAdmin={esAdmin}
            onCerrar={() => setSeleccionado(null)}
            onVerTodas={(id) => navigate(`/historial-ventas?cliente=${id}`)}
            onCambioEstado={alCambiarEstado}
          />
        </div>
      )}

      {formulario && (
        <ClienteForm cliente={formulario.cliente} onCerrar={() => setFormulario(null)} onGuardado={alGuardar} />
      )}
    </div>
  );
}