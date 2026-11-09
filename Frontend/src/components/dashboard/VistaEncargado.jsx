import { Link } from 'react-router-dom';
import { CircleCheck, CircleX, EyeOff, Package, PackagePlus, TriangleAlert } from 'lucide-react';
import { formatoCantidad, formatoFecha, formatoHora } from '../../utils/formato';
import { nivelStock } from '../../utils/stock';
import { TarjetaCifra } from './Piezas';

const TIPOS = {
  entrada: 'Entrada',
  venta: 'Venta',
  anulacion: 'Anulación',
  ajuste: 'Ajuste',
};

export default function VistaEncargado({ datos, periodoTexto }) {
  return (
    <>
      <div className="rejilla rejilla-4">
        <TarjetaCifra etiqueta="Stock bajo y crítico" valor={datos.stock.total} unidad="referencias" icono={TriangleAlert} alerta />
        <TarjetaCifra etiqueta="Productos agotados" valor={datos.stock.agotado} icono={CircleX} alerta />
        <TarjetaCifra etiqueta="Artículos activos" valor={datos.stock.activos} icono={CircleCheck} />
        <TarjetaCifra etiqueta="Desactivados" valor={datos.stock.desactivados} icono={EyeOff} />
      </div>

      <div className="rejilla rejilla-2">
        <TarjetaCifra etiqueta={`Entradas registradas · ${periodoTexto}`} valor={datos.entradas.movimientos} unidad="movimientos" icono={PackagePlus} />
        <div className="tarjeta">
          <p className="tarjeta-etiqueta">Unidades ingresadas · {periodoTexto}</p>
          <p className="tarjeta-valor">{formatoCantidad(datos.entradas.unidades)}</p>
          <span className="tarjeta-icono"><Package size={18} /></span>
        </div>
      </div>

      <section className="tarjeta dash-lista">
        <div className="top-cabecera">
          <div>
            <h2>Productos más críticos</h2>
            <p>Los primeros que conviene reponer</p>
          </div>
          <Link className="enlace" to="/inventario">Ver inventario</Link>
        </div>

        {datos.criticos.length === 0 ? (
          <p className="texto-suave">Todo el inventario está por encima de su mínimo.</p>
        ) : (
          <div className="dash-tabla-envoltorio">
            <table className="dash-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="der">Stock</th>
                  <th className="der">Mínimo</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {datos.criticos.map((p) => {
                  const nivel = nivelStock(p.existencias, p.stock_minimo);
                  return (
                    <tr key={p.codigo}>
                      <td>
                        <div className="dash-prod">{p.nombre}</div>
                        <div className="dash-sku mono">{p.codigo}</div>
                      </td>
                      <td>{p.categoria}</td>
                      <td className="der mono">{formatoCantidad(p.existencias)}</td>
                      <td className="der mono">{formatoCantidad(p.stock_minimo)}</td>
                      <td><span className={`dash-nivel ${nivel.clase}`}>{nivel.texto}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta dash-lista">
        <div className="top-cabecera">
          <div>
            <h2>Últimos movimientos</h2>
            <p>Entradas, ventas, anulaciones y ajustes</p>
          </div>
        </div>

        {datos.ultimos_movimientos.length === 0 ? (
          <p className="texto-suave">Aún no hay movimientos de inventario.</p>
        ) : (
          <div className="dash-tabla-envoltorio">
            <table className="dash-tabla">
              <thead>
                <tr>
                  <th>Fecha / hora</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="der">Cantidad</th>
                  <th className="der">Quedó en</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {datos.ultimos_movimientos.map((m) => (
                  <tr key={m.id_movimiento}>
                    <td>
                      <div>{formatoFecha(m.fecha_hora)}</div>
                      <div className="dash-sku mono">{formatoHora(m.fecha_hora)}</div>
                    </td>
                    <td>
                      <div className="dash-prod">{m.producto}</div>
                      <div className="dash-sku mono">{m.codigo}</div>
                    </td>
                    <td><span className={`dash-tipo ${m.tipo}`}>{TIPOS[m.tipo] ?? m.tipo}</span></td>
                    <td className={`der mono ${m.cantidad < 0 ? 'negativo' : 'positivo'}`}>
                      {m.cantidad > 0 ? '+' : ''}{formatoCantidad(m.cantidad)}
                    </td>
                    <td className="der mono">{formatoCantidad(m.existencias_resultantes)}</td>
                    <td>{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}