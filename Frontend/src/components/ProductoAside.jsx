import { useEffect, useState } from 'react';
import { CircleCheck, SquarePen, X } from 'lucide-react';
import { api } from '../api/cliente';
import { formatoPesos } from '../utils/formato';
import './ProductoAside.css';

const UNIDADES = ['unid', 'cajas', 'bultos', 'tubos', 'kg', 'm', 'litros', 'galones', 'rollos', 'pares'];
const TARIFAS_IVA = [
  { valor: '19', texto: '19% (Tarifa general)' },
  { valor: '5', texto: '5% (Tarifa reducida)' },
  { valor: '0', texto: '0% (Exento)' },
];

const limpiarNumero = (texto) => texto.replace(/[^\d.]/g, '');

function valoresIniciales(p) {
  return {
    codigo: p?.codigo ?? '',
    nombre: p?.nombre ?? '',
    descripcion: p?.descripcion ?? '',
    unidad_medida: p?.unidad_medida ?? 'unid',
    id_categoria: p ? String(p.id_categoria) : '',
    existencias: '', // solo se usa al crear
    stock_minimo: p ? String(p.stock_minimo) : '0',
    precio_compra: p?.precio_compra !== undefined ? String(p.precio_compra) : '',
    precio_venta: p ? String(p.precio_venta) : '',
    porcentaje_iva: p ? String(p.porcentaje_iva) : '19',
  };
}

function validar(f, { editando, esAdmin }) {
  const errores = [];
  if (!f.codigo.trim()) errores.push('El código SKU es obligatorio');
  if (!f.nombre.trim()) errores.push('El nombre es obligatorio');
  if (!f.unidad_medida.trim()) errores.push('La unidad de medida es obligatoria');
  if (!f.id_categoria) errores.push('Selecciona una categoría');
  if (f.precio_venta === '' || !(Number(f.precio_venta) >= 0)) errores.push('Escribe un precio de venta válido');
  if (esAdmin && f.precio_compra !== '' && !(Number(f.precio_compra) >= 0)) errores.push('El precio de compra no es válido');
  if (!editando && f.existencias !== '' && !(Number(f.existencias) >= 0)) errores.push('El stock inicial no es válido');
  if (f.stock_minimo !== '' && !(Number(f.stock_minimo) >= 0)) errores.push('El stock mínimo no es válido');
  return errores;
}

export default function ProductoAside({ producto, categorias, esAdmin, onCerrar, onGuardado, onCategoriaCreada }) {
  const editando = Boolean(producto);
  const [f, setF] = useState(() => valoresIniciales(producto));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState(null); // null = campo oculto

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const poner = (campo, numerico = false) => (e) => {
    const valor = numerico ? limpiarNumero(e.target.value) : e.target.value;
    setF((actual) => ({ ...actual, [campo]: valor }));
  };

  // Cálculos del módulo de precios (mismas fórmulas del mockup)
  const venta = Number(f.precio_venta) || 0;
  const compra = Number(f.precio_compra) || 0;
  const iva = Number(f.porcentaje_iva) || 0;
  const precioFinal = Math.round(venta * (1 + iva / 100));
  const margen = compra > 0 ? ((venta - compra) / compra) * 100 : null;

  const tarifas = TARIFAS_IVA.some((t) => t.valor === f.porcentaje_iva)
    ? TARIFAS_IVA
    : [...TARIFAS_IVA, { valor: f.porcentaje_iva, texto: `${f.porcentaje_iva}%` }];

  async function crearCategoria() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    try {
      const creada = await api('/categorias', { metodo: 'POST', cuerpo: { nombre } });
      onCategoriaCreada(creada);
      setF((actual) => ({ ...actual, id_categoria: String(creada.id_categoria) }));
      setNuevaCategoria(null);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    const errores = validar(f, { editando, esAdmin });
    if (errores.length > 0) return setError(errores.join('. '));

    setError('');
    setGuardando(true);

    const cuerpo = {
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim(),
      unidad_medida: f.unidad_medida.trim(),
      id_categoria: Number(f.id_categoria),
      precio_venta: Number(f.precio_venta),
      porcentaje_iva: Number(f.porcentaje_iva),
      stock_minimo: Number(f.stock_minimo || 0),
    };
    if (esAdmin) cuerpo.precio_compra = Number(f.precio_compra || 0);
    if (!editando) cuerpo.existencias = Number(f.existencias || 0);

    try {
      if (editando) {
        await api(`/productos/${producto.id_producto}`, { metodo: 'PUT', cuerpo });
        onGuardado(`Producto "${cuerpo.nombre}" actualizado`);
      } else {
        await api('/productos', { metodo: 'POST', cuerpo });
        onGuardado(`Producto "${cuerpo.nombre}" creado`);
      }
    } catch (e) {
      setError(e.detalles?.length ? e.detalles.join('. ') : e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="aside-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="aside-producto" onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-label="Formulario de producto">
        <header className="aside-cabecera">
          <div className="aside-titulo">
            <span className="aside-icono"><SquarePen size={20} /></span>
            <div>
              <h2>{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <span>Gestión de catálogo</span>
            </div>
          </div>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="aside-cuerpo">
          <div className="aside-seccion-titulo">
            <strong>Datos generales del producto</strong>
            <small>* Campos obligatorios</small>
          </div>

          {error && <div className="alerta-error" role="alert">{error}</div>}

          <div className="fila2">
            <label>
              <span>Código SKU *</span>
              <input className="mono" maxLength={30} autoFocus={!editando} value={f.codigo} onChange={poner('codigo')} placeholder="SKU-77025" />
            </label>
            <label>
              <span>Unidad de medida *</span>
              <input list="unidades" maxLength={20} value={f.unidad_medida} onChange={poner('unidad_medida')} />
              <datalist id="unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
            </label>
          </div>

          <label>
            <span>Nombre comercial y especificación *</span>
            <input maxLength={100} value={f.nombre} onChange={poner('nombre')} placeholder="Ej: Taladro Percutor DeWalt 1/2 Pulgada…" />
          </label>

          <label>
            <span>Descripción técnica (opcional)</span>
            <textarea maxLength={255} value={f.descripcion} onChange={poner('descripcion')} placeholder="Ej: Mandril industrial 13mm • Reversible y velocidad variable" />
          </label>

          <div className="fila2">
            <div>
              <label>
                <span>Categoría *</span>
                <select value={f.id_categoria} onChange={poner('id_categoria')}>
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                </select>
              </label>
              {nuevaCategoria === null ? (
                <button type="button" className="enlace aside-enlace" onClick={() => setNuevaCategoria('')}>+ Nueva categoría</button>
              ) : (
                <div className="nueva-categoria">
                  <input maxLength={50} autoFocus placeholder="Nombre" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} />
                  <button type="button" className="boton-suave" onClick={crearCategoria}>Crear</button>
                </div>
              )}
            </div>
            <label>
              <span>Stock mínimo *</span>
              <input className="mono derecha" inputMode="decimal" value={f.stock_minimo} onChange={poner('stock_minimo', true)} />
            </label>
          </div>

          {editando ? (
            <label>
              <span>Stock actual</span>
              <input className="mono derecha" value={producto.existencias} disabled />
              <small className="ayuda">Cambia con entradas, ajustes y ventas, no desde este formulario.</small>
            </label>
          ) : (
            <label>
              <span>Stock inicial *</span>
              <input className="mono derecha" inputMode="decimal" value={f.existencias} onChange={poner('existencias', true)} placeholder="0" />
            </label>
          )}

          <section className="mod-costos">
            <h3>{esAdmin ? 'Módulo de costos y precios (Admin)' : 'Precios'}</h3>

            <div className="fila2">
              {esAdmin && (
                <label>
                  <span>Precio de compra (costo base COP) *</span>
                  <div className="moneda-campo">
                    <b>$</b>
                    <input className="mono" inputMode="decimal" value={f.precio_compra} onChange={poner('precio_compra', true)} />
                  </div>
                </label>
              )}
              <label>
                <span>Precio venta (sin IVA COP) *</span>
                <div className="moneda-campo">
                  <b>$</b>
                  <input className="mono" inputMode="decimal" value={f.precio_venta} onChange={poner('precio_venta', true)} />
                </div>
              </label>
              <label>
                <span>Tasa de impuesto IVA *</span>
                <select value={f.porcentaje_iva} onChange={poner('porcentaje_iva')}>
                  {tarifas.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
                </select>
              </label>
              {esAdmin && (
                <div className="margen">
                  <span>Margen bruto calculado:</span>
                  <strong className={`mono ${margen !== null && margen < 0 ? 'negativo' : ''}`}>
                    {margen === null ? '—' : `${margen >= 0 ? '+' : ''}${margen.toFixed(1)}%`}
                  </strong>
                </div>
              )}
            </div>

            <div className="precio-final">
              <div>
                <small>Precio final sugerido al mostrador</small>
                <span className="sub">Incluye impuesto liquidado al cliente</span>
              </div>
              <div>
                <div className="valor mono">{formatoPesos(precioFinal)}</div>
                <span className="cop">COP / unidad</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="aside-pie">
          <button type="button" className="boton-secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton-primario" disabled={guardando}>
            <CircleCheck size={18} />
            {guardando ? 'Guardando…' : 'Guardar producto'}
          </button>
        </footer>
      </form>
    </div>
  );
}