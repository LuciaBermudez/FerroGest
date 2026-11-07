const redondear = (n) => Math.round(n * 100) / 100;

// El catálogo muestra el precio final al cliente (con IVA), como en el mockup
export const precioConIva = (producto) =>
  Math.round(producto.precio_venta * (1 + producto.porcentaje_iva / 100));

export const totalLinea = (producto, cantidad) =>
  producto.precio_venta * cantidad * (1 + producto.porcentaje_iva / 100);

// Misma fórmula que el backend: el descuento se aplica a todas las líneas y el IVA va sobre lo descontado
export function calcularTotales(items, descuentoPct) {
  const factor = 1 - descuentoPct / 100;
  let subtotal = 0;
  let iva = 0;
  const tarifas = new Set();

  for (const { producto, cantidad } of items) {
    const base = producto.precio_venta * cantidad;
    subtotal += base;
    iva += base * factor * (producto.porcentaje_iva / 100);
    tarifas.add(producto.porcentaje_iva);
  }

  subtotal = redondear(subtotal);
  const descuento = redondear((subtotal * descuentoPct) / 100);
  const ivaTotal = redondear(iva);

  return {
    subtotal,
    descuento,
    ivaTotal,
    total: redondear(subtotal - descuento + ivaTotal),
    tarifaUnica: tarifas.size === 1 ? [...tarifas][0] : null, // para mostrar "IVA general (19%)"
  };
}