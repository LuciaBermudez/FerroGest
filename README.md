# FerroGest

**Sistema web de gestión de inventarios y facturación para ferreterías**, con paneles por rol y un asistente conversacional de IA para consultar la información del negocio.

> Proyecto académico desarrollado para la materia **Sistemas de información**.

---

## Descripción

FerroGest centraliza la operación diaria de una ferretería: controla el inventario, registra ventas en el mostrador con facturación simulada, administra clientes y usuarios, y muestra indicadores adaptados al rol de cada persona. Incluye un asistente de IA que responde, en lenguaje natural, preguntas sobre existencias, precios, ventas y clientes, usando únicamente consultas de lectura predefinidas.

El foco del sistema es la **gestión de inventario**: cada entrada, venta y anulación queda registrada como un movimiento, de modo que las existencias siempre son consistentes y trazables.

## Funcionalidades

### Autenticación
- Inicio de sesión con correo y contraseña; la sesión dura 8 horas y se puede cerrar en cualquier momento.
- Si un usuario se desactiva, pierde el acceso de inmediato, aunque tenga una sesión abierta.
- Las contraseñas olvidadas las restablece el administrador desde el módulo de usuarios.

### Usuarios y roles
- Tres roles: **Administrador**, **Vendedor/Cajero** y **Encargado del Inventario**.
- Crear, editar, desactivar y reactivar usuarios, con búsqueda, filtros y paginación.
- Restablecimiento de contraseñas desde el formulario de edición.
- Protecciones: nadie puede desactivarse a sí mismo ni cambiarse su propio rol.

### Productos e inventario
- Catálogo con código (SKU o código de barras), nombre, descripción técnica, categoría, unidad de medida, precio de compra, precio de venta (sin IVA), IVA y stock mínimo.
- El formulario calcula en vivo el **margen bruto** y el **precio final sugerido** al mostrador.
- Desactivación de productos en lugar de eliminación, para conservar el historial.
- **Registro de entradas** de mercancía, con nota opcional.
- Tarjetas de resumen: total de referencias, activos, bajo el stock mínimo y desactivados.
- Filtros por categoría y por nivel de stock (todos, normal, bajo el mínimo), con alertas visuales.
- Cada cambio de existencias queda en un **historial de movimientos** (entrada, venta, anulación, ajuste), con las existencias resultantes y el usuario responsable.

### Ventas (punto de venta)
- Catálogo de mostrador con búsqueda por código de barras, SKU o nombre, y filtro por categoría. Un lector de códigos de barras agrega el producto directamente.
- Panel de ticket a la derecha con cantidades editables, descuento comercial en porcentaje y cálculo de subtotal, IVA por producto y total.
- Formas de pago: efectivo, tarjeta o transferencia, con monto recibido y cambio opcionales.
- **Cliente:** el cajero llena los datos; el sistema lo busca por documento y, si no existe, lo registra. También existe el cliente predefinido «Consumidor Final».
- Confirmación en una sola transacción: descuenta el stock, asigna un consecutivo con formato `TK-año-número` y rechaza la venta si no hay existencias suficientes.
- **Anulación** (solo administrador) con motivo obligatorio, que devuelve el stock automáticamente.
- La facturación es **simulada**: el ticket no tiene validez fiscal.

### Historial de ventas
- Listado paginado con filtros por número de ticket, estado, forma de pago, rango de fechas y cliente.
- Panel lateral con el detalle completo del ticket (cliente, vendedor, productos, subtotal, descuento, IVA y total).
- El administrador ve todas las ventas; el vendedor solo las suyas.

### Clientes
- Personas naturales y empresas, con tipo de documento CC, CE, NIT o pasaporte.
- Registro, edición, búsqueda, filtros y desactivación.
- Ficha de detalle con datos de contacto y, para el administrador, el **total acumulado comprado** y el historial de compras, con acceso al historial de ventas filtrado por cliente.

### Dashboard por rol
Todos los usuarios entran al dashboard, pero cada rol recibe datos distintos; el filtrado ocurre en el servidor, no solo en la pantalla.

| Rol | Qué ve |
|---|---|
| Administrador | Ventas del día y del mes, total y ticket promedio del periodo, comprobantes anulados, efectivo vs digital, clientes por tipo, stock bajo y Top 5 de productos |
| Vendedor/Cajero | Lo mismo, pero calculado solo con **sus** ventas, más los productos agotados y con stock bajo |
| Encargado del Inventario | Estado del inventario, entradas del periodo, productos más críticos y últimos movimientos; ninguna cifra de dinero |

El periodo se elige entre hoy, esta semana y este mes.

### Asistente de IA
- Panel de chat flotante en el dashboard, con historial de la conversación (se conserva al recargar la página) y preguntas rápidas.
- **Solo consulta**: no crea ventas ni modifica datos. El modelo no escribe SQL: solo puede pedir funciones predefinidas, y el servidor las ejecuta.
- Las respuestas incluyen tarjetas con los datos consultados.
- Consultas disponibles:
  - Todos los roles: productos con stock bajo o agotados, y existencias y precio de un producto.
  - Solo administrador: ventas por periodo, productos más vendidos, historial de compras de un cliente y ventas por vendedor.
- Controles: preguntas de hasta 500 caracteres, 15 consultas por minuto por usuario y 30 segundos de tiempo máximo de espera.

## Roles y permisos

| Módulo / acción | Administrador | Encargado | Vendedor |
|---|:---:|:---:|:---:|
| Dashboard | Negocio completo | Inventario | Sus ventas |
| Registrar ventas | Sí | No | Sí |
| Historial de ventas | Todas | No | Solo las suyas |
| Anular ventas | Sí | No | No |
| Registrar y editar clientes | Sí | No | Sí |
| Historial de compras del cliente | Sí | No | No |
| Desactivar clientes | Sí | No | No |
| Consultar existencias | Inventario | Inventario | Catálogo de ventas |
| Crear y editar productos y categorías | Sí | Sí | No |
| Ver y editar precio de compra | Sí | No | No |
| Activar y desactivar productos | Sí | Sí | No |
| Registrar entradas de inventario | Sí | Sí | No |
| Gestionar usuarios | Sí | No | No |
| Asistente de IA | Todas las consultas | Solo inventario | Solo inventario |

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React, Vite, React Router, lucide-react, CSS propio |
| Backend | Node.js, Express, mysql2, jsonwebtoken, bcryptjs, dotenv, cors |
| Base de datos | MySQL 8.0.16 o superior |
| Inteligencia artificial | API de OpenAI (Responses API con llamadas a funciones) mediante el SDK `openai` |
| Herramientas | Git y GitHub, Figma (prototipos), MySQL Workbench, Postman |

## Arquitectura

El backend sigue el patrón **MVC** en capas:

- **Modelo** (`models/`): todo el acceso a la base de datos; las consultas son parametrizadas.
- **Controlador** (`controllers/` y `routes/`): reciben las peticiones, validan los datos, aplican los permisos y responden.
- **Vista**: la interfaz en React (`Frontend/`), que consume la API REST en formato JSON.
- **Servicios** (`services/`): lógica compartida, como las transacciones, el control de stock y el asistente de IA.

```
FerroGest/
├── Backend/
│   └── src/
│       ├── config/        conexión a MySQL
│       ├── models/        acceso a datos (usuario, producto, cliente, venta, movimiento, reporte…)
│       ├── controllers/   lógica de cada módulo
│       ├── routes/        rutas de la API
│       ├── middlewares/   autenticación y control de roles
│       ├── services/      transacciones de inventario y asistente de IA
│       ├── scripts/       creación del administrador inicial
│       ├── app.js
│       └── server.js
├── Frontend/
│   └── src/
│       ├── api/           cliente HTTP
│       ├── components/    paneles, formularios y piezas del dashboard
│       ├── context/       sesión del usuario
│       ├── hooks/         estado del ticket y del chat
│       ├── pages/         una pantalla por módulo
│       └── utils/         formatos, roles y cálculos
├── Database/              script SQL de la base de datos
└── Docs/                  documento de requisitos (IEEE 830) y prototipos
```

## Modelo de datos

Tablas principales: `rol`, `usuario`, `cliente`, `categoria`, `producto`, `venta`, `detalle_venta` y `movimiento_inventario`, además de la vista `v_productos_stock_bajo`.

- Los precios se guardan **sin IVA**; el IVA se calcula por producto.
- `detalle_venta` conserva el precio y el IVA de cada producto al momento de la venta.
- `movimiento_inventario` funciona como kárdex: la cantidad lleva signo y se guardan las existencias resultantes.
- Los productos, clientes y usuarios **no se eliminan**: se desactivan.
- La tabla `token_recuperacion` está creada para la recuperación de contraseñas por correo, una mejora futura.

## Reglas de negocio destacadas

- **Totales:** subtotal = suma de precio × cantidad; el descuento porcentual se aplica a todas las líneas y el IVA se calcula sobre el valor ya descontado. El servidor calcula todo y nunca confía en los precios que envía el navegador.
- **Integridad:** registrar una venta es una transacción; bloquea las filas de los productos para que dos ventas simultáneas no dejen el stock mal, y el stock nunca queda negativo.
- **Anulaciones:** una venta anulada no se puede volver a anular y devuelve el stock con un movimiento de tipo «anulación».
- **Documentos de clientes:** se normalizan (sin puntos ni espacios) para evitar duplicados.

## Seguridad

- Contraseñas almacenadas con hash **bcrypt**.
- Autenticación con **JWT**; en cada petición el servidor consulta la base de datos para confirmar que el usuario sigue activo y cuál es su rol actual.
- Permisos verificados en el servidor para cada ruta, no solo ocultos en la interfaz.
- Consultas SQL parametrizadas y validación de todos los datos de entrada.
- La clave de la API de IA solo existe en el servidor (archivo `.env`, excluido de Git).
- El asistente de IA solo ejecuta funciones de lectura predefinidas y limitadas por rol.

## API REST (resumen)

Todas las rutas cuelgan de `/api` y, salvo el login, requieren el header `Authorization: Bearer <token>`.

| Recurso | Rutas | Acceso |
|---|---|---|
| `/auth` | `POST /login`, `GET /perfil` | Login público; perfil con sesión |
| `/usuarios` | `GET /`, `GET /roles`, `POST /`, `PUT /:id`, `PATCH /:id/estado`, `PATCH /:id/contrasena` | Administrador |
| `/categorias` | `GET /`, `POST /` | Lectura: todos. Creación: administrador y encargado |
| `/productos` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/estado` | Lectura: todos. Escritura: administrador y encargado |
| `/movimientos` | `GET /`, `POST /entrada`, `POST /ajuste` | Administrador y encargado |
| `/clientes` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/estado` | Administrador y vendedor (el estado, solo administrador) |
| `/ventas` | `POST /`, `GET /`, `GET /:id`, `POST /:id/anular` | Administrador y vendedor (anular, solo administrador) |
| `/dashboard` | `GET /?periodo=hoy\|semana\|mes` | Todos, con datos según el rol |
| `/chat` | `POST /` | Todos, con herramientas según el rol |

