import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { api } from '../api/cliente';
import { ROLES } from '../utils/roles';
import { fechaLarga } from '../utils/formato';
import VistaAdmin from '../components/dashboard/VistaAdmin';
import VistaVendedor from '../components/dashboard/VistaVendedor';
import VistaEncargado from '../components/dashboard/VistaEncargado';
import './Dashboard.css';

const PERIODOS = [
  { valor: 'hoy', texto: 'Hoy', titulo: 'Top 5 de Hoy', corto: 'hoy' },
  { valor: 'semana', texto: 'Esta Semana', titulo: 'Top 5 de la Semana', corto: 'esta semana' },
  { valor: 'mes', texto: 'Este Mes', titulo: 'Top 5 del Mes', corto: 'este mes' },
];

const VISTAS = {
  [ROLES.ADMIN]: VistaAdmin,
  [ROLES.VENDEDOR]: VistaVendedor,
  [ROLES.ENCARGADO]: VistaEncargado,
};

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('hoy');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true; // evita que una respuesta lenta pise a una más reciente
    setCargando(true);
    setError('');

    api(`/dashboard?periodo=${periodo}`)
      .then((respuesta) => vigente && setDatos(respuesta))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));

    return () => {
      vigente = false;
    };
  }, [periodo, intento]);

  const periodoActual = PERIODOS.find((p) => p.valor === periodo);
  const Vista = datos ? VISTAS[datos.rol] : null;

  return (
    <div>
      <div className="dashboard-cabecera">
        <h1 className="titulo-pagina">Dashboard</h1>
        <div className="selector" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              className={p.valor === periodo ? 'activo' : ''}
              onClick={() => setPeriodo(p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="fecha">
        <CalendarDays size={18} />
        {fechaLarga()}
      </div>

      {error && (
        <div className="alerta-error" role="alert">
          {error}{' '}
          <button className="enlace" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {!datos && cargando && <p className="texto-suave">Cargando datos…</p>}

      {Vista && (
        <div className={cargando ? 'actualizando' : ''}>
          <Vista datos={datos} tituloTop={periodoActual.titulo} periodoTexto={periodoActual.corto} />
        </div>
      )}
    </div>
  );
}