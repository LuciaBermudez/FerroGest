// Agotado: 0. Crítico: la mitad del mínimo o menos. Alerta: bajo el mínimo
export function nivelStock(existencias, minimo) {
  if (existencias <= 0) return { texto: 'Agotado', clase: 'agotado' };
  if (existencias <= minimo / 2) return { texto: 'Crítico', clase: 'critico' };
  if (existencias <= minimo) return { texto: 'Alerta', clase: 'alerta' };
  return { texto: 'Normal', clase: 'normal' };
}