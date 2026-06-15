-- Disable old Supabase pg_cron job (process-ai-queue processes posts, not promises)
-- Promises are now processed by Vercel cron via /api/cron/process-pending
SELECT cron.unschedule('ai-queue-processor') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-queue-processor'
);

-- Verify job removed
SELECT jobname, active FROM cron.job WHERE jobname = 'ai-queue-processor';
