# Informe de auditoría — FerroGest

**Fecha:** 15 de noviembre de 2026
**Rama de trabajo:** `audit/seguridad-calidad`
**Base:** `main` (`fb46cd6`)
**Alcance:** Backend Node.js/Express + MySQL, frontend React/Vite y scripts de base de datos.

---

## 1. Resumen ejecutivo

Se revisó el código completo, se ejecutó la aplicación contra una instancia MySQL aislada y se construyó una suite automatizada de **119 pruebas** (74 de backend y 45 de frontend). La suite inicial, ejecutada contra el código sin modificar, encontró **14 fallos reales** en 69 pruebas de backend. Todos los defectos corregidos quedaron cubiertos por pruebas y la suite final pasa al 100 %.

Los problemas más importantes eran:

1. **Ventas simultáneas fallaban con error 500** por un bloqueo mutuo al calcular el consecutivo del ticket.
2. **El login no tenía límite de intentos**, lo que permitía fuerza bruta de contraseñas.
3. **CORS respondía `*`**, exponiendo la API a cualquier origen web.
4. **Errores de la API devolvían HTML** (404 y JSON mal formado), con posible filtración de trazas de Express.
5. **Se aceptaban valores no finitos** (`Infinity`, `NaN`) en campos monetarios y de inventario.

No se encontraron inyecciones SQL: todas las consultas están parametrizadas. El control de roles y el estado del usuario se validan en el servidor en cada petición. `npm audit --omit=dev` no reportó vulnerabilidades en dependencias de producción.

> **Nota operativa:** el cambio del consecutivo introduce la tabla `secuencia_ticket`. En una base existente hay que aplicar `Database/migrations/001_secuencia_ticket.sql` antes de desplegar (ver §6).

---

## 2. Metodología y entorno

| Actividad | Detalle |
|---|---|
| Revisión estática | Lectura de rutas, controladores, modelos, middlewares, servicios, hooks y utilidades |
| Ejecución | Backend y frontend levantados localmente; base de datos MySQL 8.4 aislada en el puerto 3307 |
| Pruebas de API | `node:test` + `fetch` contra un servidor HTTP real y una base `ferrogest_test` |
| Pruebas de frontend | Vitest 5 + Testing Library + jsdom |
| Análisis de dependencias | `npm audit --omit=dev` en backend y frontend |
| Calidad estática | `npm run lint` y `npm run build` en frontend |

**Protección de datos:** la suite se niega a ejecutarse si `DB_NAME` no termina en `_test`. La base real `ferrogest` no se modificó en ningún momento.

---

## 3. Hallazgos y correcciones

Severidad: **Alta** (rompe operación o seguridad), **Media** (impacto relevante o defensa en profundidad), **Baja** (calidad, robustez o accesibilidad).

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| V-01 | Alta | Ventas simultáneas fallan con 500 por deadlock del consecutivo | Corregido |
| S-01 | Alta | Login sin límite de intentos | Corregido |
| S-02 | Media | CORS abierto a cualquier origen | Corregido |
| S-03 | Media | 404 y JSON inválido devuelven HTML; posible traza de Express | Corregido |
| V-02 | Media | `monto_recibido: "Infinity"` aceptado en una venta | Corregido |
| V-03 | Media | Validación numérica débil en productos y movimientos | Corregido |
| S-04 | Media | Faltan cabeceras de seguridad y se anuncia `X-Powered-By` | Corregido |
| S-05 | Media | Sin límite de tamaño para el cuerpo JSON | Corregido |
| V-04 | Baja | El login no normaliza espacios ni mayúsculas del correo | Corregido |
| V-05 | Baja | Ruta `/api/health` duplicada | Corregido |
| V-06 | Baja | Nombre de categoría > 50 caracteres producía error 500 | Corregido |
| S-06 | Baja | Tiempo de respuesta del login revelaba si un correo existía | Corregido |
| S-07 | Media | JWT guardado en `localStorage` | Documentado, sin cambio |
| S-08 | Media | Límites de login/chat en memoria: no sirven con varias instancias | Documentado, sin cambio |
| S-09 | Media | Historial del chat enviado por el cliente permite inyección de instrucciones | Mitigado, documentado |
| A-01 | Baja | Modales sin trampa de foco | Documentado, sin cambio |
| S-10 | Baja | Sin CSP ni HSTS propios | Documentado, sin cambio |

### V-01 — Deadlock al generar el consecutivo de la venta (Alta)

**Evidencia.** La prueba de 5 ventas concurrentes devolvía `[201, 201, 500, 500, 500]`.

**Causa.** `Venta.siguienteNumero` ejecutaba `SELECT MAX(numero) + 1 FROM venta FOR UPDATE`. Con InnoDB, ese bloqueo entra en conflicto con los índices y las inserciones concurrentes, produciendo deadlocks y `ER_LOCK_DEADLOCK`.

**Corrección.**

- Nueva tabla `secuencia_ticket` con una sola fila (`id = 1`, `ultimo`).
- `siguienteNumero` hace `UPDATE secuencia_ticket SET ultimo = LAST_INSERT_ID(ultimo + 1) WHERE id = 1` y lee `LAST_INSERT_ID()` en la misma conexión.
- La fila queda bloqueada hasta el `COMMIT`, así las cajas esperan su turno en lugar de chocar.
- Migración `Database/migrations/001_secuencia_ticket.sql` que arranca en `MAX(numero)` para no repetir tickets existentes.

**Prueba.** `Backend/test/ventas.test.js` → «las ventas simultáneas generan consecutivos únicos y descuentan el stock correcto»: 5 ventas concurrentes deben devolver 201, 5 números distintos y stock final correcto.

### S-01 — Login sin límite de intentos (Alta)

**Evidencia.** Cinco contraseñas incorrectas y un login correcto posterior devolvían 200; no había bloqueo.

**Corrección.** Middleware `loginRateLimit.middleware.js`: máximo 5 fallos por IP + correo en 15 minutos, respuesta 429 con `Retry-After`. Los errores 400 (datos incompletos) no cuentan y un login correcto limpia el contador.

**Prueba.** `Backend/test/auth.test.js` → «bloquea el login tras varios intentos fallidos seguidos».

### S-02 — CORS abierto (Media)

**Evidencia.** Con `Origin: https://sitio-malicioso.test`, la respuesta incluía `Access-Control-Allow-Origin: *`.

**Corrección.** Lista blanca desde `CORS_ORIGIN` (separada por comas). Sin `Origin` (health checks, mismo origen) se permite; un origen no listado no recibe cabecera CORS. Preflight con `maxAge` y métodos explícitos.

**Prueba.** `Backend/test/seguridad.test.js` → origen permitido, origen ajeno y preflight.

### S-03 — Errores en HTML (Media)

**Evidencia.** `/api/no-existe` y un JSON mal formado devolvían `text/html`; el manejador por defecto de Express puede incluir la traza en desarrollo.

**Corrección.** 404 JSON para rutas desconocidas y manejador central de errores que traduce `entity.parse.failed` a 400 y `entity.too.large` a 413, siempre en JSON y sin exponer detalles internos.

**Prueba.** `Backend/test/seguridad.test.js` → 404 y JSON inválido en JSON.

### V-02 — `Infinity` aceptado como monto recibido (Media)

**Evidencia.** `{ "monto_recibido": "Infinity" }` devolvía 201.

**Causa.** `Number('Infinity')` es `Infinity` y la comprobación `>= 0` lo acepta.

**Corrección.** `Number.isFinite` en descuento, monto recibido, identificadores y cantidades. También se valida que `id_cliente` sea entero positivo.

**Prueba.** `Backend/test/ventas.test.js` → caso `monto_recibido: "Infinity"` dentro de «valida los datos de la venta».

### V-03 — Validación numérica débil (Media)

**Evidencia.** Precios, IVA, stock y cantidades usaban comparaciones `>=`, que aceptan `Infinity`; `id_categoria` no se comprobaba como entero.

**Corrección.**

- Productos: `Number.isFinite` para precios, IVA, stock mínimo y existencias; `id_categoria` entero positivo.
- Movimientos: cantidad finita y distinta de cero en ajustes; producto entero positivo.
- Categorías: nombre máximo 50 caracteres (coincide con `VARCHAR(50)`).

**Pruebas.** Nuevos casos en `productos.test.js` e `inventario.test.js`; nuevo `categorias.test.js` con permisos, duplicados y límites.

### S-04 — Cabeceras de seguridad (Media)

**Corrección.** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-XSS-Protection: 0` y `Permissions-Policy` restrictiva. `X-Powered-By` desactivado. Se implementó sin añadir dependencias.

**Prueba.** `Backend/test/seguridad.test.js` → «incluye cabeceras básicas de seguridad».

### S-05 — Cuerpo JSON sin límite (Media)

**Corrección.** `express.json({ limit: '100kb' })`. Un cuerpo mayor recibe 413 en JSON.

### V-04 — Correo con espacios o mayúsculas (Baja)

**Evidencia.** `"  admin@test.local  "` devolvía 401.

**Corrección.** `trim().toLowerCase()` en el login. En usuarios y clientes ya se normalizaba; se conserva esa coherencia.

**Prueba.** `Backend/test/auth.test.js` → «login tolera espacios alrededor del correo».

### V-05 — Health duplicado (Baja)

**Causa.** `app.js` definía dos veces `/api/health`; la segunda definición prevalecía y la primera era código muerto.

**Corrección.** Una sola ruta, que informa `estado`, `backend` y base de datos activa.

### V-06 — Categoría demasiado larga (Baja)

**Corrección.** Validación de longitud antes de llegar a MySQL, evitando un 500 por `Data too long`.

### S-06 — Enumeración de usuarios por tiempo (Baja)

**Corrección.** Cuando el correo no existe se compara igualmente un hash bcrypt ficticio, para que el tiempo de respuesta sea similar al de una contraseña incorrecta. El mensaje ya era genérico.

---

## 4. Hallazgos documentados, no corregidos

Estos puntos requieren una decisión de arquitectura o un cambio mayor; se dejan registrados para el equipo.

### S-07 — JWT en `localStorage` (Media)

`Frontend/src/api/cliente.js` guarda el token en `localStorage`. Cualquier XSS podría leerlo. En este proyecto no se encontró uso de `dangerouslySetInnerHTML`, `innerHTML` ni `eval`, y React escapa el texto por defecto, por lo que el riesgo actual es acotado.

**Recomendación.** Migrar a cookie `HttpOnly; Secure; SameSite=Strict` con protección CSRF, o mantener `localStorage` y añadir una CSP estricta en el frontend. La sesión ya expira a las 8 horas y el servidor revalida usuario y rol en cada petición, lo que limita el impacto de un token robado.

### S-08 — Límites en memoria (Media)

El límite de login (`loginRateLimit.middleware.js`) y el del chat (15 consultas/minuto por usuario, en `chat.controller.js`) viven en la memoria del proceso. Con varias instancias o réplicas, cada una lleva su propio contador.

**Recomendación.** Usar Redis (o el almacén compartido de la plataforma) antes de escalar horizontalmente. El límite por IP también depende de `TRUST_PROXY`: detrás de Railway/Render debe activarse para leer la IP real, y la API no debe quedar expuesta directamente.

### S-09 — Inyección de instrucciones en el chat (Media)

El frontend envía el historial de la conversación y el backend lo sanea (roles permitidos, últimos 10 mensajes, 1000 caracteres), pero un cliente manipulado puede inyectar texto con instrucciones para el modelo.

**Mitigación existente.** El modelo no escribe SQL ni ejecuta acciones: solo puede invocar herramientas de lectura, filtradas por rol y revalidadas al ejecutarlas. No hay escritura de datos ni escalada de privilegios.

**Recomendación.** No confiar en el historial del cliente: persistir la conversación en el servidor o firmarla, y añadir instrucciones de sistema que ignoren contenido del usuario que intente cambiar el rol o las reglas.

### A-01 — Accesibilidad de modales (Baja)

Los modales usan `role="dialog"`, `aria-modal` y cierran con Escape, pero no atrapan el foco ni lo devuelven al botón que los abrió. **Recomendación:** componente de diálogo con trampa de foco y `aria-labelledby`.

### S-10 — CSP y HSTS (Baja)

No se define `Content-Security-Policy` ni `Strict-Transport-Security`. **Recomendación:** configurarlos en el proxy/CDN (Vercel/Railway) o añadirlos al backend cuando el frontend se sirva desde el mismo dominio.

---

## 5. Pruebas automatizadas

### 5.1 Resultados

| Suite | Antes de las correcciones | Después |
|---|---|---|
| Backend (`node:test`) | 69 pruebas: 55 pasan, **14 fallan** | **74 pasan, 0 fallan** |
| Frontend (Vitest) | No existía | **45 pasan, 0 fallan** |
| **Total** | — | **119 pruebas** |

Los 14 fallos iniciales fueron: normalización del correo, límite de login (2), CORS/cabeceras/404/JSON/health (6), saneamiento y herramientas del chat (4), validación de `Infinity` y concurrencia de ventas (2).

### 5.2 Cobertura funcional del backend

| Archivo | Qué cubre |
|---|---|
| `auth.test.js` | Login correcto/incorrecto, normalización, usuario inactivo, cambio de rol, rate limit, perfil |
| `seguridad.test.js` | Health, 404 JSON, JSON inválido, CORS, preflight, cabeceras |
| `usuarios.test.js` | CRUD, permisos, duplicados, autoprotección del administrador, cambio de contraseña, invalidación de sesión |
| `productos.test.js` | Permisos, filtros, costo oculto por rol, creación con kárdex inicial, validaciones (incluye `Infinity`), 404 |
| `categorias.test.js` | Sesión, permisos, orden, duplicados, longitud máxima |
| `clientes.test.js` | Persona/empresa, documento normalizado, duplicados, Consumidor Final protegido, historial solo admin |
| `inventario.test.js` | Entradas, ajustes, stock negativo, kárdex, filtros, cantidades no finitas |
| `ventas.test.js` | Totales con descuento e IVA, stock, kárdex, anulación, aislamiento por vendedor, concurrencia |
| `dashboard.test.js` | Datos por rol, filtrado en servidor, periodo inválido, rol sin dashboard |
| `chat.test.js` | Validación, 503 sin clave, límite de uso, herramientas por rol, saneamiento del historial |

### 5.3 Cobertura funcional del frontend

- `utils/venta.test.js`: totales, descuento antes de IVA, redondeo, precio con IVA.
- `utils/stock.test.js`: umbrales agotado/crítico/alerta/normal.
- `utils/formato.test.js`: miles, pesos, abreviaturas, documentos, iniciales y fechas.
- `utils/roles.test.js`: ruta inicial, menú filtrado por rol, descripciones.
- `api/cliente.test.js`: token, cabeceras, cuerpo JSON, `ErrorApi`, 401, fallo de red, JSON inválido.
- `hooks/useTicket.test.jsx`: agregar, tope de existencias, cantidades, quitar, descuento, cambio, reinicio.
- `components/RutaProtegida.test.jsx`: carga, sin sesión, sesión válida, rol permitido/denegado.
- `components/Paginacion.test.jsx`: extremos, navegación, elipsis, página única.

### 5.4 Cómo reproducirlas

```bash
# 1. Base de pruebas (nunca la real)
sed 's/ferrogest/ferrogest_test/g' Database/schema.sql | mysql -u root -p
mysql -u root -p ferrogest_test < Database/migrations/001_secuencia_ticket.sql

# 2. Configuración
cp Backend/.env.test.example Backend/.env.test   # ajustar credenciales

# 3. Backend
cd Backend && npm test

# 4. Frontend
cd Frontend && npm test
```

La suite de backend aborta de inmediato si `DB_NAME` no termina en `_test`.

### 5.5 Calidad estática

- `npm run lint` (frontend): pasa con las mismas 10 advertencias previas (`set-state-in-effect` y `only-export-components`); no se introdujeron nuevas.
- `npm run build` (frontend): compila correctamente.
- `npm audit --omit=dev`: 0 vulnerabilidades en backend y frontend.

---

## 6. Cambios entregados

### Backend

- `src/app.js`: CORS con lista blanca, cabeceras de seguridad, health único, límite de 100 kB, 404/errores JSON, `X-Powered-By` desactivado, `TRUST_PROXY`.
- `src/middlewares/loginRateLimit.middleware.js` **(nuevo)**.
- `src/controllers/auth.controller.js`: normalización del correo y comparación con hash ficticio.
- `src/controllers/venta.controller.js`: validación con `Number.isFinite`.
- `src/controllers/producto.controller.js`: validación numérica completa.
- `src/controllers/movimiento.controller.js`: cantidades e identificadores válidos.
- `src/controllers/categoria.controller.js`: longitud máxima.
- `src/models/venta.model.js`: consecutivo atómico.
- `src/controllers/chat.controller.js` y `src/services/asistente.service.js`: helpers exportados para pruebas.
- `src/routes/auth.routes.js`: aplicación del rate limit.
- `package.json`: script `test`.

### Base de datos

- `Database/schema.sql`: tabla `secuencia_ticket` y fila inicial.
- `Database/migrations/001_secuencia_ticket.sql` **(nuevo)**: migración segura para bases existentes.

### Frontend

- `package.json`: scripts `test` y `test:watch`; Vitest, Testing Library y jsdom.
- `vite.config.js`: configuración de Vitest con jsdom.
- `src/test/setup.js` y 8 archivos de prueba nuevos.

### Documentación

- `README.md`: seguridad actualizada, arquitectura, modelo de datos y sección de pruebas/migración.
- `Backend/.env.example`: `CORS_ORIGIN` y `TRUST_PROXY`.
- `Backend/.env.test.example`: plantilla de configuración de pruebas.
- `.gitignore`: excepción para publicar `.env.test.example`.
- `Docs/INFORME-AUDITORIA.md`: este informe.

---

## 7. Recomendaciones priorizadas

1. **Antes de desplegar:** aplicar la migración `001_secuencia_ticket.sql` y definir `CORS_ORIGIN` con el dominio real. Si hay proxy, activar `TRUST_PROXY=true`.
2. **Corto plazo:** mover los contadores de login/chat a un almacén compartido si se escala a más de una instancia; definir una política de respaldo de la base.
3. **Mediano plazo:** evaluar cookies `HttpOnly` + CSRF o una CSP estricta para reducir el riesgo del token en `localStorage`.
4. **Mediano plazo:** persistir el historial del chat en el servidor y reforzar las instrucciones del sistema frente a inyección de prompts.
5. **Continuo:** ejecutar `npm test` en CI (GitHub Actions) con un servicio MySQL, además de `lint` y `build`. Añadir pruebas E2E de los flujos de venta y anulación con Playwright.
6. **Accesibilidad:** trampa de foco y retorno de foco en modales; revisar contraste y navegación por teclado.

---

## 8. Conclusión

El sistema parte de una base sólida: separación por capas, consultas parametrizadas, transacciones para el inventario y autorización verificada en el servidor. Los defectos encontrados se concentraban en concurrencia, endurecimiento de la API y validación de entrada; los cinco de mayor impacto quedaron corregidos y cubiertos por pruebas. La suite de 119 pruebas permite repetir la verificación y detectar regresiones en futuras iteraciones.
