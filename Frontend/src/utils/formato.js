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

// "24 May 2024"
export function formatoFecha(valor) {
  const partes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .formatToParts(new Date(valor));
  const parte = (tipo) => partes.find((p) => p.type === tipo)?.value ?? '';
  const mes = parte('month').replace('.', '');
  return `${parte('day')} ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${parte('year')}`;
}

// "15:42:10"
export const formatoHora = (valor) =>
  new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date(valor));

export const etiquetaDocumento = (tipo) => (tipo === 'CC' ? 'C.C.' : tipo);

// 1020458912 → 1.020.458.912 y 900548120-3 → 900.548.120-3 (solo para CC y NIT numéricos)
export function formatoDocumento(tipo, documento) {
  if ((tipo === 'CC' || tipo === 'NIT') && /^\d+(-\d)?$/.test(documento)) {
    const [numero, digito] = documento.split('-');
    const conPuntos = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return digito !== undefined ? `${conPuntos}-${digito}` : conPuntos;
  }
  return documento;
}

// "Constructora Andina S.A.S." → "CA"
export function iniciales(nombre = '') {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

// "10:42 a. m."
export const formatoHoraCorta = (valor) =>
  new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(valor));