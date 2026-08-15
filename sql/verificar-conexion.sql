-- Verificación de conexión (SOLO LECTURA — no cambia nada).
-- Consulta las tablas directo (no las vistas): con la clave pública esto daría
-- 401, así que si devuelve números, el MCP de Supabase está bien conectado.

select
  (select count(*) from coordinadores where not anulado)                      as coordinadores_activos,
  (select count(*) from coordinadores where rol = 'Albergue' and not anulado) as albergues,
  (select count(*) from reportes)                                             as reportes_total,
  (select count(*) from reportes where device = 'seed-albergue-need')         as necesidades_albergue,
  now()                                                                       as hora_servidor;
