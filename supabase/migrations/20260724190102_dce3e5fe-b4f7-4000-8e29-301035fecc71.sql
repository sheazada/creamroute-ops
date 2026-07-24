
-- Enums
DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('email','sms','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('queued','sending','sent','failed','suppressed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.notification_channel NOT NULL,
  status  public.notification_status  NOT NULL DEFAULT 'queued',

  recipient        text NOT NULL,           -- email address or phone (E.164)
  recipient_name   text,
  subject          text,                    -- email subject (nullable for sms)
  body             text,                    -- rendered body / sms text
  template         text,                    -- template key (e.g. 'delivery-status-update')
  template_data    jsonb NOT NULL DEFAULT '{}'::jsonb,

  customer_id      uuid REFERENCES public.customers(id)  ON DELETE SET NULL,
  invoice_id       uuid REFERENCES public.invoices(id)   ON DELETE SET NULL,
  delivery_id     uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,

  idempotency_key  text UNIQUE,             -- prevents duplicate sends for the same event

  attempts         int  NOT NULL DEFAULT 0,
  max_attempts     int  NOT NULL DEFAULT 5,
  last_error       text,
  provider         text,                    -- 'lovable-email', 'twilio', etc.
  provider_message_id text,

  last_attempt_at  timestamptz,
  next_retry_at    timestamptz,
  sent_at          timestamptz,

  triggered_by     uuid,                    -- auth.users id of the user that fired it (no FK to auth.users)

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can manage notification logs" ON public.notification_logs;
CREATE POLICY "Team can manage notification logs"
  ON public.notification_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notif_logs_status_retry
  ON public.notification_logs (status, next_retry_at)
  WHERE status IN ('queued','failed');

CREATE INDEX IF NOT EXISTS idx_notif_logs_invoice   ON public.notification_logs (invoice_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_delivery  ON public.notification_logs (delivery_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_customer  ON public.notification_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created   ON public.notification_logs (created_at DESC);

-- updated_at trigger (uses existing tg_set_updated_at)
DROP TRIGGER IF EXISTS trg_notif_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trg_notif_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: record the outcome of a send attempt and schedule next retry
CREATE OR REPLACE FUNCTION public.record_notification_attempt(
  _id           uuid,
  _success      boolean,
  _error        text DEFAULT NULL,
  _provider     text DEFAULT NULL,
  _provider_msg text DEFAULT NULL,
  _suppressed   boolean DEFAULT false
) RETURNS public.notification_logs
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.notification_logs;
  v_attempts int;
  v_next_status public.notification_status;
  v_next_retry timestamptz;
  v_backoff interval;
BEGIN
  SELECT * INTO v_row FROM public.notification_logs WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'notification_logs % not found', _id; END IF;

  v_attempts := v_row.attempts + 1;

  IF _suppressed THEN
    v_next_status := 'suppressed';
    v_next_retry  := NULL;
  ELSIF _success THEN
    v_next_status := 'sent';
    v_next_retry  := NULL;
  ELSIF v_attempts >= v_row.max_attempts THEN
    v_next_status := 'failed';
    v_next_retry  := NULL;
  ELSE
    v_next_status := 'failed';
    -- exponential backoff: 1m, 5m, 15m, 1h, 6h
    v_backoff := (CASE v_attempts
                    WHEN 1 THEN interval '1 minute'
                    WHEN 2 THEN interval '5 minutes'
                    WHEN 3 THEN interval '15 minutes'
                    WHEN 4 THEN interval '1 hour'
                    ELSE      interval '6 hours'
                  END);
    v_next_retry := now() + v_backoff;
  END IF;

  UPDATE public.notification_logs
     SET attempts            = v_attempts,
         status              = v_next_status,
         last_error          = CASE WHEN _success THEN NULL ELSE _error END,
         provider            = COALESCE(_provider, provider),
         provider_message_id = COALESCE(_provider_msg, provider_message_id),
         last_attempt_at     = now(),
         next_retry_at       = v_next_retry,
         sent_at             = CASE WHEN _success THEN now() ELSE sent_at END
   WHERE id = _id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
