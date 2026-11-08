import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Paginacion.css';

// Muestra: 1 2 3 … 238 (primera, última y las cercanas a la actual)
function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const base = new Set([1, total, actual - 1, actual, actual + 1]);
  const ordenadas = [...base].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const resultado = [];
  ordenadas.forEach((p, i) => {
    if (i > 0 && p - ordenadas[i - 1] > 1) resultado.push('…');
    resultado.push(p);
  });
  return resultado;
}

export default function Paginacion({ pagina, totalPaginas, onCambiar }) {
  return (
    <nav className="paginacion-num" aria-label="Paginación">
      <button onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
        <ChevronLeft size={16} />
      </button>

      {paginasVisibles(pagina, totalPaginas).map((p, i) =>
        p === '…' ? (
          <span className="puntos" key={`puntos-${i}`}>…</span>
        ) : (
          <button key={p} className={p === pagina ? 'activo' : ''} onClick={() => onCambiar(p)} aria-current={p === pagina ? 'page' : undefined}>
            {p}
          </button>
        )
      )}

      <button onClick={() => onCambiar(pagina + 1)} disabled={pagina >= totalPaginas} aria-label="Página siguiente">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}