// useGrouping: 'always' fuerza el punto de miles también en números de 4 cifras (1.189)
const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: 'always' });
const cantidad = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: 'always' });

export const formatoNumero = (n) => entero.format(n ?? 0);
export const formatoCantidad = (n) => cantidad.format(n ?? 0);
export const formatoPesos = (n) => `$ ${entero.format(Math.round(n ?? 0))}`;

// Abreviado para espacios pequeños: $2.04M (si es menor a un millón, se muestra completo)
export function formatoCorto(n) {
  const valor = n ?? 0;
  return valor >= 1_000_000 ? `$${(valor / 1_000_000).toFixed(2)}M` : formatoPesos(valor);
}

export function fechaLarga(fecha = new Date()) {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const nombreMes = (fecha = new Date()) =>
  new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(fecha);