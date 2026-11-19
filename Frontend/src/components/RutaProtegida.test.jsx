import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RutaProtegida from './RutaProtegida';
import { ROLES } from '../utils/roles';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../context/AuthContext';

function renderizar(rutaInicial, { roles } = {}) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route path="/login" element={<p>pantalla de login</p>} />
        <Route path="/dashboard" element={<p>pantalla dashboard</p>} />
        <Route element={<RutaProtegida roles={roles} />}>
          <Route path="/privado" element={<p>contenido privado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuth.mockReset();
});

describe('RutaProtegida', () => {
  test('muestra la carga mientras se valida el token', () => {
    useAuth.mockReturnValue({ usuario: null, cargando: true });
    renderizar('/privado');
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  test('sin sesión redirige al login', () => {
    useAuth.mockReturnValue({ usuario: null, cargando: false });
    renderizar('/privado');
    expect(screen.getByText('pantalla de login')).toBeInTheDocument();
  });

  test('con sesión y sin roles exige solo estar autenticado', () => {
    useAuth.mockReturnValue({ usuario: { rol: ROLES.VENDEDOR }, cargando: false });
    renderizar('/privado');
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });

  test('un rol no permitido vuelve a su pantalla inicial', () => {
    useAuth.mockReturnValue({ usuario: { rol: ROLES.VENDEDOR }, cargando: false });
    renderizar('/privado', { roles: [ROLES.ADMIN] });
    expect(screen.getByText('pantalla dashboard')).toBeInTheDocument();
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument();
  });

  test('un rol permitido entra al contenido', () => {
    useAuth.mockReturnValue({ usuario: { rol: ROLES.ADMIN }, cargando: false });
    renderizar('/privado', { roles: [ROLES.ADMIN, ROLES.ENCARGADO] });
    expect(screen.getByText('contenido privado')).toBeInTheDocument();
  });
});
