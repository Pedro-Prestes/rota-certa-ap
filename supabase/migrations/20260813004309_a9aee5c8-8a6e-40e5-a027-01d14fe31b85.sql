SELECT cron.schedule(
  'fechamento-saidas-minuto',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--5a782f90-57db-441e-954d-7637513d4f72.lovable.app/api/public/rotas/fechamento?env=live',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "087c583c000c0464975b50807ec40a343a13c9095743019788687ed6e7753406"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);