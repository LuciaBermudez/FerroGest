import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Save, User, UserPlus, X } from 'lucide-react';
import { api } from '../api/cliente';
import { DESCRIPCION_ROL, ORDEN_ROLES, ROLES } from '../utils/roles';
import './UsuarioForm.css';

const DOMINIO = 'ferrogest.com';
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UsuarioForm({ usuario, roles, esMismoUsuario, onCerrar, onGuardado }) {
  const editando = Boolean(usuario);
  const [datos, setDatos] = useState({
    nombre_completo: usuario?.nombre_completo ?? '',
    correo: usuario?.correo ?? '',
    id_rol: usuario ? String(usuario.id_rol) : '',
    contrasena: '',
  });
  const [verContrasena, setVerContrasena] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const rolesOrdenados = [...roles].sort(
    (a, b) => ORDEN_ROLES.indexOf(a.nombre) - ORDEN_ROLES.indexOf(b.nombre)
  );

  // Al crear, "Vendedor/Cajero" viene marcado por defecto, como en el mockup
  const rolPorDefecto = rolesOrdenados.find((r) => r.nombre === ROLES.VENDEDOR)?.id_rol;
  const rolSeleccionado = datos.id_rol || (!editando && rolPorDefecto ? String(rolPorDefecto) : '');
  const rolBloqueado = editando && esMismoUsuario; // no puedes cambiarte el rol a ti mismo

  const poner = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function enviar(evento) {
    evento.preventDefault();

    const nombre = datos.nombre_completo.trim();
    let correo = datos.correo.trim().toLowerCase();
    // Si solo escribe "d.ospina", se completa con el dominio corporativo
    if (correo && !correo.includes('@')) correo = `${correo}@${DOMINIO}`;

    const errores = [];
    if (!nombre) errores.push('Escribe el nombre completo');
    if (nombre.length > 100) errores.push('El nombre no puede superar los 100 caracteres');
    if (!REGEX_CORREO.test(correo) || correo.length > 100) errores.push('El correo no es válido');
    if (!rolSeleccionado) errores.push('Selecciona un rol');

    // Al crear la contraseña es obligatoria; al editar solo si se quiere cambiar
    if (!editando || datos.contrasena !== '') {
      if (datos.contrasena.length < 8 || datos.contrasena.length > 72) {
        errores.push('La contraseña debe tener entre 8 y 72 caracteres');
      }
    }
    if (errores.length > 0) return setError(errores.join('. '));

    setError('');
    setGuardando(true);

    try {
      const cuerpo = { nombre_completo: nombre, correo, id_rol: Number(rolSeleccionado) };

      if (editando) {
        await api(`/usuarios/${usuario.id_usuario}`, { metodo: 'PUT', cuerpo });
        if (datos.contrasena) {
          await api(`/usuarios/${usuario.id_usuario}/contrasena`, {
            metodo: 'PATCH',
            cuerpo: { contrasena: datos.contrasena },
          });
        }
        onGuardado(`Usuario "${nombre}" actualizado${datos.contrasena ? ' y contraseña restablecida' : ''}`);
      } else {
        await api('/usuarios', { metodo: 'POST', cuerpo: { ...cuerpo, contrasena: datos.contrasena } });
        onGuardado(`Usuario "${nombre}" creado`);
      }
    } catch (e) {
      setError(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Formulario de usuario">
        <header className="modal-cabecera">
          <div className="modal-titulo">
            <span className="modal-icono"><UserPlus size={20} /></span>
            <div>
              <h2>{editando ? 'Editar usuario' : 'Formulario de usuario'}</h2>
              <span className="modal-subtitulo">Credenciales y permisos de acceso</span>
            </div>
          </div>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="modal-cuerpo">
          {error && <div className="alerta-error" role="alert">{error}</div>}

          <div>
            <label className="modal-etiqueta" htmlFor="uf-nombre">Nombre completo *</label>
            <div className="campo-icono">
              <User size={16} />
              <input id="uf-nombre" type="text" autoFocus maxLength={100} placeholder="Ej: Roberto Albarracín"
                value={datos.nombre_completo} onChange={poner('nombre_completo')} />
            </div>
          </div>

          <div>
            <label className="modal-etiqueta etiqueta-fila" htmlFor="uf-correo">
              Correo corporativo * <span className="dominio">@{DOMINIO}</span>
            </label>
            <div className="campo-icono">
              <Mail size={16} />
              <input id="uf-correo" type="text" inputMode="email" maxLength={100} placeholder={`r.albarracin@${DOMINIO}`}
                value={datos.correo} onChange={poner('correo')} />
            </div>
          </div>

          <div>
            <span className="modal-etiqueta">Rol *</span>
            <div className="rol-opciones">
              {rolesOrdenados.map((r) => (
                <label
                  key={r.id_rol}
                  className={`rol-opcion ${String(r.id_rol) === rolSeleccionado ? 'activa' : ''} ${rolBloqueado ? 'bloqueada' : ''}`}
                >
                  <input
                    type="radio" name="rol" disabled={rolBloqueado}
                    checked={String(r.id_rol) === rolSeleccionado}
                    onChange={() => setDatos((d) => ({ ...d, id_rol: String(r.id_rol) }))}
                  />
                  <strong>{r.nombre}</strong>
                  <span>{DESCRIPCION_ROL[r.nombre]}</span>
                </label>
              ))}
            </div>
            {rolBloqueado && <span className="ayuda-modal">No puedes cambiar tu propio rol.</span>}
          </div>

          <div>
            <label className="modal-etiqueta etiqueta-fila" htmlFor="uf-contrasena">
              {editando ? 'Nueva contraseña (opcional)' : 'Contraseña inicial *'}
              <span className="opcional">Mínimo 8 caracteres</span>
            </label>
            <div className="campo-icono">
              <Lock size={16} />
              <input
                id="uf-contrasena" type={verContrasena ? 'text' : 'password'} maxLength={72}
                autoComplete="new-password" placeholder="••••••••••••"
                value={datos.contrasena} onChange={poner('contrasena')}
              />
              <button type="button" className="boton-icono ver-contrasena" onClick={() => setVerContrasena((v) => !v)}
                aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verContrasena ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {editando && <span className="ayuda-modal">Déjala vacía para conservar la contraseña actual.</span>}
          </div>
        </div>

        <footer className="modal-pie">
          <span />
          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              <Save size={16} />
              {guardando ? 'Guardando…' : 'Guardar usuario'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}