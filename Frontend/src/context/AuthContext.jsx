import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, borrarToken, guardarToken, obtenerToken, registrarAlExpirarSesion } from '../api/cliente';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Si hay un token guardado, hay que validarlo antes de decidir qué pantalla mostrar
  const [cargando, setCargando] = useState(Boolean(obtenerToken()));

  const cerrarSesion = useCallback(() => {
    borrarToken();
    setUsuario(null);
  }, []);

  useEffect(() => {
    registrarAlExpirarSesion(cerrarSesion);
  }, [cerrarSesion]);

  // Al abrir la app: se valida el token guardado con el servidor
  useEffect(() => {
    if (!obtenerToken()) return;
    api('/auth/perfil')
      .then(setUsuario)
      .catch(cerrarSesion)
      .finally(() => setCargando(false));
  }, [cerrarSesion]);

  async function iniciarSesion(correo, contrasena) {
    const datos = await api('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena } });
    guardarToken(datos.token);
    setUsuario(datos.usuario);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);