import { useMemo, useState } from 'react';
import { calcularTotales } from '../utils/venta';

// Cliente por defecto: el servidor lo resuelve cuando no se envía id_cliente
export const CLIENTE_GENERICO = {
  id_cliente: null,
  tipo: 'persona_natural',
  tipo_documento: 'CC',
  documento: '222222222222',
  nombre_razon_social: 'Consumidor Final',
};

export function useTicket() {
  const [items, setItems] = useState([]); // [{ producto, cantidad }]
  const [cliente, setCliente] = useState(CLIENTE_GENERICO);
  const [medioPago, setMedioPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [montoRecibido, setMontoRecibido] = useState(''); // solo dígitos

  const totales = useMemo(() => calcularTotales(items, descuento), [items, descuento]);

  // El monto es opcional: vacío significa pago exacto
  const recibido = montoRecibido === '' ? null : Number(montoRecibido);
  const cambio = recibido === null ? null : recibido - totales.total;
  const montoInsuficiente = recibido !== null && recibido < totales.total;
  const puedeConfirmar = items.length > 0 && !montoInsuficiente;

  function agregar(producto) {
    setItems((actuales) => {
      const existente = actuales.find((i) => i.producto.id_producto === producto.id_producto);
      if (!existente) return [...actuales, { producto, cantidad: 1 }];
      return actuales.map((i) =>
        i === existente ? { producto, cantidad: Math.min(i.cantidad + 1, producto.existencias) } : i
      );
    });
  }

  function cambiarCantidad(idProducto, cantidad) {
    setItems((actuales) =>
      actuales.map((i) =>
        i.producto.id_producto === idProducto
          ? { ...i, cantidad: Math.min(Math.max(cantidad, 1), i.producto.existencias) }
          : i
      )
    );
  }

  function quitar(idProducto) {
    setItems((actuales) => actuales.filter((i) => i.producto.id_producto !== idProducto));
  }

  function reiniciar() {
    setItems([]);
    setCliente(CLIENTE_GENERICO);
    setMedioPago('efectivo');
    setDescuento(0);
    setMontoRecibido('');
  }

  return {
    items, cliente, setCliente, medioPago, setMedioPago, descuento, setDescuento,
    montoRecibido, setMontoRecibido, totales, recibido, cambio, montoInsuficiente, puedeConfirmar,
    agregar, cambiarCantidad, quitar, reiniciar,
  };
}