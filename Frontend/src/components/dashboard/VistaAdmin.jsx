import { Building2, CircleX, Receipt, ShoppingCart, TrendingUp, TriangleAlert, User } from 'lucide-react';
import { nombreMes } from '../../utils/formato';
import {
  TarjetaCifra, TarjetaDinero, TarjetaEfectivoDigital, TarjetaFila, TarjetaTotal, TopProductos,
} from './Piezas';

export default function VistaAdmin({ datos, tituloTop }) {
  return (
    <>
      <div className="rejilla rejilla-4">
        <TarjetaDinero etiqueta="Ventas del día (hoy)" valor={datos.ventas_hoy.total} icono={ShoppingCart} />
        <TarjetaDinero etiqueta={`Ventas del mes (${nombreMes()})`} valor={datos.ventas_mes.total} icono={TrendingUp} />
        <TarjetaCifra etiqueta="Stock bajo y crítico" valor={datos.stock.total} unidad="referencias" icono={TriangleAlert} alerta />
        <TarjetaTotal valor={datos.resumen.total_vendido} />
      </div>

      <div className="rejilla rejilla-3">
        <TarjetaDinero etiqueta="Ticket promedio" valor={datos.resumen.ticket_promedio} icono={Receipt} />
        <TarjetaCifra etiqueta="Comprobantes anulados" valor={datos.resumen.anuladas} icono={CircleX} alerta />
        <TarjetaEfectivoDigital medios={datos.medios_pago} />
      </div>

      <div className="rejilla rejilla-2">
        <TarjetaFila etiqueta="Personas naturales" valor={datos.clientes.personas_naturales} icono={User} />
        <TarjetaFila etiqueta="Empresas (NIT)" valor={datos.clientes.empresas} icono={Building2} />
      </div>

      <TopProductos titulo={tituloTop} top={datos.top_productos} />
    </>
  );
}