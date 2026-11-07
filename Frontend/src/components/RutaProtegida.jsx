import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rutaInicial } from '../utils/roles';

// Sin "roles": exige sesión. Con "roles": además exige que el usuario tenga uno de ellos
export default function RutaProtegida({ roles }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <div className="pantalla-carga">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={rutaInicial(usuario.rol)} replace />;
  }

  return <Outlet />;
}