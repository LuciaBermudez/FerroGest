import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROLES, rutaInicial } from './utils/roles';
import RutaProtegida from './components/RutaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pendiente from './pages/Pendiente';
import Ventas from './pages/Ventas';
import Inventario from './pages/Inventario';

// Cualquier ruta desconocida lleva al inicio del rol, o al login si no hay sesión
function Inicio() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return <Navigate to={usuario ? rutaInicial(usuario.rol) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route element={<RutaProtegida roles={[ROLES.ADMIN]} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/usuarios" element={<Pendiente titulo="Usuarios" />} />
          </Route>

          <Route element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.VENDEDOR]} />}>
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/clientes" element={<Pendiente titulo="Clientes" />} />
            <Route path="/historial-ventas" element={<Pendiente titulo="Historial de Ventas" />} />
          </Route>

          <Route element={<RutaProtegida roles={[ROLES.ADMIN, ROLES.ENCARGADO]} />}>
            <Route path="/inventario" element={<Inventario />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
}