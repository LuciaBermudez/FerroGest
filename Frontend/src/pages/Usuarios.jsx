import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, CircleCheck, Pencil, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { formatoNumero } from '../utils/formato';
import Paginacion from '../components/Paginacion';
import UsuarioForm from '../components/UsuarioForm';
import './Usuarios.css';

const LIMITE = 8;

export default function Usuarios() {
  const { usuario: yo } = useAuth();

  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);

  const [roles, setRoles] = useState([]);
  const [lista, setLista] = useState({ datos: [], total: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [formulario, setFormulario] = useState(null); // { usuario } — usuario null = nuevo

  const peticion = useRef(0);

  useEffect(() => {
    api('/usuarios/roles').then(setRoles).catch((e) => setError(e.message));
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
    if (rol) params.set('rol', rol);
    if (estado) params.set('activo', estado);

    try {
      const respuesta = await api(`/usuarios?${params}`);
      if (id !== peticion.current) return;
      setLista(respuesta);
      setError('');
    } catch (e) {
      if (id === peticion.current) setError(e.message);
    } finally {
      if (id === peticion.current) setCargando(false);
    }
  }, [pagina, busquedaAplicada, rol, estado]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  function alGuardar(texto) {
    setFormulario(null);
    setMensaje(texto);
    cargarLista();
  }

  async function alternarEstado(u) {
    const nuevo = !u.activo;
    const pregunta = nuevo
      ? `¿Activar a "${u.nombre_completo}"?`
      : `¿Desactivar a "${u.nombre_completo}"? Perderá el acceso al sistema de inmediato.`;
    if (!window.confirm(pregunta)) return;

    try {
      await api(`/usuarios/${u.id_usuario}/estado`, { metodo: 'PATCH', cuerpo: { activo: nuevo } });
      setMensaje(`Usuario "${u.nombre_completo}" ${nuevo ? 'activado' : 'desactivado'}`);
      cargarLista();
    } catch (e) {
      setError(e.message);
    }
  }

  const { datos: usuarios, total } = lista;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const inicio = total === 0 ? 0 : (pagina - 1) * LIMITE + 1;
  const fin = Math.min(pagina * LIMITE, total);

  return (
    <div>
      <div className="us-cabecera">
        <div>
          <h1 className="titulo-pagina">Gestión de Usuarios y Roles</h1>
          <p className="us-descripcion">
            Control de accesos al sistema, asignación de permisos y credenciales del personal de la tienda.
          </p>
        </div>
        <div className="us-cabecera-acciones">
          <span className="us-nivel"><ShieldCheck size={16} /> Nivel: Super Admin</span>
          <button className="us-boton-nuevo" onClick={() => setFormulario({ usuario: null })} disabled={roles.length === 0}>
            <UserPlus size={18} /> Nuevo usuario
          </button>
        </div>
      </div>

      {mensaje && <div className="alerta-exito" role="status">{mensaje}</div>}
      {error && (
        <div className="alerta-error" role="alert">
          {error} <button className="enlace" onClick={() => { setError(''); cargarLista(); }}>Reintentar</button>
        </div>
      )}

      <div className="us-filtros">
        <div className="us-busqueda">
          <Search size={18} />
          <input
            type="search" placeholder="Buscar por nombre o correo…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select value={rol} onChange={(e) => { setRol(e.target.value); setPagina(1); }} aria-label="Rol">
          <option value="">Todos los roles</option>
          {roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <div className="us-caja">
        <div className={`us-envoltorio ${cargando ? 'actualizando' : ''}`}>
          <table className="us-tabla">
            <thead>
              <tr>
                <th>Usuario / nombre</th>
                <th>Correo electrónico</th>
                <th>Rol asignado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const soyYo = u.id_usuario === yo.id;
                return (
                  <tr key={u.id_usuario} className={u.activo ? '' : 'inactivo'}>
                    <td className="us-nombre">{u.nombre_completo}{soyYo && <span className="us-yo">Tú</span>}</td>
                    <td className="mono us-correo">{u.correo}</td>
                    <td><span className={`us-rol ${u.rol === ROLES.ADMIN ? 'admin' : ''}`}>{u.rol}</span></td>
                    <td><span className={`us-estado ${u.activo ? 'activo' : 'inactivo'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div className="us-acciones">
                        <button
                          className="boton-icono" onClick={() => setFormulario({ usuario: u })}
                          title="Editar" aria-label={`Editar a ${u.nombre_completo}`}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className={`boton-icono ${u.activo ? 'us-baja' : 'us-alta'}`}
                          onClick={() => alternarEstado(u)}
                          disabled={soyYo}
                          title={soyYo ? 'No puedes desactivarte a ti mismo' : u.activo ? 'Desactivar' : 'Activar'}
                          aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre_completo}`}
                        >
                          {u.activo ? <Ban size={18} /> : <CircleCheck size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!cargando && usuarios.length === 0 && !error && (
            <div className="us-vacio">No hay usuarios que coincidan con la búsqueda.</div>
          )}
        </div>

        <footer className="us-pie">
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} onCambiar={setPagina} />
          <span>Mostrando {inicio} - {fin} de {formatoNumero(total)} usuarios</span>
        </footer>
      </div>

      {formulario && (
        <UsuarioForm
          usuario={formulario.usuario}
          roles={roles}
          esMismoUsuario={formulario.usuario?.id_usuario === yo.id}
          onCerrar={() => setFormulario(null)}
          onGuardado={alGuardar}
        />
      )}
    </div>
  );
}