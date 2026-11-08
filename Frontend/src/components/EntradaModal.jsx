import { useEffect, useState } from 'react';
import { PackagePlus, X } from 'lucide-react';
import { api } from '../api/cliente';
import { formatoCantidad } from '../utils/formato';
import './EntradaModal.css';

export default function EntradaModal({ onCerrar, onRegistrada }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  // Búsqueda de producto con espera de 300 ms
  useEffect(() => {
    const texto = busqueda.trim();
    if (!texto || producto) {
      setResultados([]);
      return undefined;
    }

    let vigente = true;
    const espera = setTimeout(() => {
      api(`/productos?buscar=${encodeURIComponent(texto)}&activo=true&limite=5`)
        .then((r) => vigente && setResultados(r.datos))
        .catch(() => vigente && setResultados([]));
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda, producto]);

  function elegir(p) {
    setProducto(p);
    setBusqueda('');
    setResultados([]);
  }

  async function enviar(evento) {
    evento.preventDefault();
    const n = Number(cantidad);
    if (!producto) return setError('Selecciona un producto');
    if (!(n > 0)) return setError('La cantidad debe ser mayor a 0');

    setError('');
    setGuardando(true);
    try {
      const cuerpo = { id_producto: producto.id_producto, cantidad: n };
      if (nota.trim()) cuerpo.nota = nota.trim();

      const r = await api('/movimientos/entrada', { metodo: 'POST', cuerpo });
      onRegistrada(
        `Entrada registrada: "${producto.nombre}" ahora tiene ${formatoCantidad(r.existencias_resultantes)} ${producto.unidad_medida}`
      );
    } catch (e) {
      setError(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setGuardando(false);
    }
  }

  const n = Number(cantidad);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="modal" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Registrar entrada">
        <header className="modal-cabecera">
          <div className="modal-titulo">
            <span className="modal-icono"><PackagePlus size={20} /></span>
            <div>
              <h2>Registrar entrada</h2>
              <span className="modal-subtitulo">Ingreso de mercancía al inventario</span>
            </div>
          </div>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="modal-cuerpo">
          {error && <div className="alerta-error" role="alert">{error}</div>}

          <div>
            <span className="modal-etiqueta">Producto *</span>
            {producto ? (
              <div className="entrada-producto">
                <div>
                  <strong>{producto.nombre}</strong>
                  <div className="entrada-detalle mono">
                    {producto.codigo} · Stock actual: {formatoCantidad(producto.existencias)} {producto.unidad_medida}
                  </div>
                </div>
                <button type="button" className="enlace" onClick={() => setProducto(null)}>Cambiar</button>
              </div>
            ) : (
              <>
                <input
                  type="text" autoFocus placeholder="Busca por SKU, código de barras o nombre…"
                  value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                />
                {resultados.length > 0 && (
                  <ul className="entrada-resultados">
                    {resultados.map((p) => (
                      <li key={p.id_producto}>
                        <button type="button" onClick={() => elegir(p)}>
                          <span>{p.nombre}</span>
                          <span className="mono entrada-detalle">{p.codigo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="modal-etiqueta" htmlFor="cantidad-entrada">Cantidad que ingresa *</label>
            <input
              id="cantidad-entrada" type="text" inputMode="decimal" placeholder="Ej: 50"
              value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>

          <div>
            <label className="modal-etiqueta" htmlFor="nota-entrada">Nota (opcional)</label>
            <input
              id="nota-entrada" type="text" maxLength={200} placeholder="Ej: Compra a proveedor, factura #1234"
              value={nota} onChange={(e) => setNota(e.target.value)}
            />
          </div>

          {producto && n > 0 && (
            <div className="entrada-previa">
              Quedará en{' '}
              <strong className="mono">
                {formatoCantidad(producto.existencias)} + {formatoCantidad(n)} = {formatoCantidad(producto.existencias + n)} {producto.unidad_medida}
              </strong>
            </div>
          )}
        </div>

        <footer className="modal-pie">
          <span />
          <div className="modal-acciones">
            <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="boton-primario" disabled={guardando}>
              {guardando ? 'Registrando…' : 'Registrar entrada'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}