import { LayoutDashboard, ShoppingCart, Warehouse, Users, ReceiptText, Settings } from 'lucide-react';

export const ROLES = {
  ADMIN: 'Administrador',
  VENDEDOR: 'Vendedor/Cajero',
  ENCARGADO: 'Encargado del Inventario',
};

// Pantalla a la que llega cada rol después de iniciar sesión
const INICIO = {
  [ROLES.ADMIN]: '/dashboard',
  [ROLES.VENDEDOR]: '/ventas',
  [ROLES.ENCARGADO]: '/inventario',
};
export const rutaInicial = (rol) => INICIO[rol] ?? '/login';

// Menú de la barra lateral
export const MENU = [
  {
    seccion: 'Operaciones',
    items: [
      { ruta: '/dashboard', texto: 'Dashboard', icono: LayoutDashboard, roles: [ROLES.ADMIN] },
      { ruta: '/ventas', texto: 'Ventas', icono: ShoppingCart, roles: [ROLES.ADMIN, ROLES.VENDEDOR] },
      { ruta: '/inventario', texto: 'Inventario', icono: Warehouse, roles: [ROLES.ADMIN, ROLES.ENCARGADO] },
      { ruta: '/clientes', texto: 'Clientes', icono: Users, roles: [ROLES.ADMIN, ROLES.VENDEDOR] },
      { ruta: '/historial-ventas', texto: 'Historial de Ventas', icono: ReceiptText, roles: [ROLES.ADMIN, ROLES.VENDEDOR] },
    ],
  },
  {
    seccion: 'Configuración',
    items: [{ ruta: '/usuarios', texto: 'Usuarios', icono: Settings, roles: [ROLES.ADMIN] }],
  },
];

export const DESCRIPCION_ROL = {
  [ROLES.VENDEDOR]: 'Cobro rápido, arqueo y tickets de venta.',
  [ROLES.ADMIN]: 'Gestión total, anulación de cobros y stock.',
  [ROLES.ENCARGADO]: 'Gestión del inventario; puede agregar productos.',
};

// Orden en que se muestran las tarjetas de rol, como en el mockup
export const ORDEN_ROLES = [ROLES.VENDEDOR, ROLES.ADMIN, ROLES.ENCARGADO];