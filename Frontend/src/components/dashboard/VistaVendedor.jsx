import { CircleX, Receipt, ShoppingCart, TrendingUp, TriangleAlert } from 'lucide-react';
import { nombreMes } from '../../utils/formato';
import {
  TarjetaCifra, TarjetaDinero, TarjetaEfectivoDigital, TarjetaFila, TarjetaTotal, TopProductos,
} from './Piezas';

export default function VistaVendedor({ datos, tituloTop }) {
  return (
    <>
      <div className="rejilla rejilla-4">
        <TarjetaDinero etiqueta="Mis ventas del día" valor={datos.ventas_hoy.total} icono={ShoppingCart} />
        <TarjetaDinero etiqueta={`Mis ventas del mes (${nombreMes()})`} valor={datos.ventas_mes.total} icono={TrendingUp} />
        <TarjetaCifra etiqueta="Mis tickets del periodo" valor={datos.resumen.num_ventas} unidad="ventas" icono={Receipt} />
        <TarjetaTotal etiqueta="Total de mis ventas" valor={datos.resumen.total_vendido} />
      </div>

      <div className="rejilla rejilla-3">
        <TarjetaDinero etiqueta="Ticket promedio" valor={datos.resumen.ticket_promedio} icono={Receipt} />
        <TarjetaCifra etiqueta="Mis comprobantes anulados" valor={datos.resumen.anuladas} icono={CircleX} alerta />
        <TarjetaEfectivoDigital medios={datos.medios_pago} />
      </div>

      <div className="rejilla rejilla-2">
        <TarjetaFila
          etiqueta="Productos agotados" valor={datos.stock.agotado} icono={CircleX} tono="rojo"
          nota="Avisa al cliente antes de ofrecerlos"
        />
        <TarjetaFila
          etiqueta="Productos con stock bajo" valor={datos.stock.bajo} icono={TriangleAlert} tono="ambar"
          nota="Quedan pocas unidades"
        />
      </div>

        <TopProductos titulo={`Mis más vendidos · ${tituloTop}`} top={datos.top_productos} />
    </>
  );
}