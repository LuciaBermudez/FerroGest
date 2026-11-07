import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, Store, User, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MENU } from '../utils/roles';
import './Layout.css';

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="app">
      <aside className="barra-lateral">
        <div className="marca">
          <div className="marca-icono"><Wrench size={22} /></div>
          <span>FerroGest</span>
        </div>

        {MENU.map((seccion) => {
          const items = seccion.items.filter((item) => item.roles.includes(usuario.rol));
          if (items.length === 0) return null;

          return (
            <div key={seccion.seccion}>
              <p className="seccion-titulo">{seccion.seccion}</p>
              <nav className="menu">
                {items.map(({ ruta, texto, icono: Icono }) => (
                  <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? 'activo' : '')}>
                    <Icono size={20} />
                    <span>{texto}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          );
        })}
      </aside>

      <div className="contenido">
        <header className="encabezado">
          <div className="migas">
            <Store size={16} />
            <span>Ferretería Central</span>
            <span>›</span>
            <strong>Panel de Operaciones</strong>
          </div>

          <div className="usuario">
            <div className="usuario-datos">
              <div className="usuario-nombre">{usuario.nombre}</div>
              <div className="usuario-rol">{usuario.rol}</div>
            </div>
            <div className="avatar"><User size={20} /></div>
            <button className="boton-icono" onClick={cerrarSesion} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="pagina">
          <Outlet />
        </main>
      </div>
    </div>
  );
}