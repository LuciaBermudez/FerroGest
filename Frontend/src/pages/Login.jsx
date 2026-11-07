import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, AtSign, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { rutaInicial } from '../utils/roles';
import './Login.css';

export default function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión, no tiene sentido ver el login
  if (usuario) return <Navigate to={rutaInicial(usuario.rol)} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(correo.trim(), contrasena);
    } catch (e) {
      setError(e.estado === 401 ? 'Correo o contraseña incorrectos' : e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={enviar} noValidate>
        <h1>Iniciar Sesión</h1>
        <p className="login-subtitulo">
          Ingresa tus credenciales para acceder a la terminal de trabajo.
        </p>

        {error && <div className="alerta-error" role="alert">{error}</div>}

        <div className="campo">
          <div className="campo-cabecera">
            <label htmlFor="correo">Correo electrónico</label>
          </div>
          <div className="entrada">
            <AtSign size={18} />
            <input
              id="correo"
              type="email"
              autoComplete="username"
              placeholder="usuario@ferrogest.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="campo">
          <div className="campo-cabecera">
            <label htmlFor="contrasena">Contraseña</label>
            <button type="button" className="enlace" onClick={() => setMostrarAyuda((v) => !v)}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="entrada">
            <Lock size={18} />
            <input
              id="contrasena"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
            />
            <button
              type="button"
              className="boton-icono ver"
              onClick={() => setVerContrasena((v) => !v)}
              aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verContrasena ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {mostrarAyuda && (
          <div className="alerta-info">
            Para restablecer tu contraseña, pídele al administrador que la cambie desde el módulo de Usuarios.
          </div>
        )}

        <button type="submit" className="boton-primario" disabled={enviando || !correo || !contrasena}>
          {enviando ? 'Ingresando…' : <>Ingresar al Sistema <ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  );
}