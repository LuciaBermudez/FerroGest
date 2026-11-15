-- Migración: consecutivo de tickets sin bloqueos de tabla completa
--
-- Antes se calculaba con "SELECT MAX(numero) + 1 FROM venta FOR UPDATE".
-- Con dos cajas vendiendo a la vez eso producía bloqueos mutuos (deadlocks)
-- y ventas rechazadas con error 500. Ahora el consecutivo vive en una fila
-- única que se incrementa de forma atómica.
--
-- Aplicar una sola vez sobre la base existente:
--   mysql -u ferrogest_app -p ferrogest < Database/migrations/001_secuencia_ticket.sql

CREATE TABLE IF NOT EXISTS secuencia_ticket (
  id     TINYINT PRIMARY KEY,
  ultimo INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Arranca desde el último número ya emitido para no repetir tickets.
SET @ultimo_ticket = (SELECT COALESCE(MAX(numero), 0) FROM venta);

INSERT INTO secuencia_ticket (id, ultimo)
VALUES (1, @ultimo_ticket)
ON DUPLICATE KEY UPDATE ultimo = GREATEST(ultimo, @ultimo_ticket);
