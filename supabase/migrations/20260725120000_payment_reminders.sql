-- Payment Reminder Templates
-- Defines the rules for sending reminders (e.g., 3 days overdue, 7 days overdue)
CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., "3 Days Overdue"
  days_overdue INT NOT NULL UNIQUE, -- e.g., 3, 7, 15
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  subject TEXT, -- For email
  body TEXT NOT NULL, -- Message body with variables: {customer_name}, {outstanding}, {invoice_no}, {due_date}
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_templates_select" ON public.reminder_templates;
DROP POLICY IF EXISTS "reminder_templates_insert" ON public.reminder_templates;
DROP POLICY IF EXISTS "reminder_templates_update" ON public.reminder_templates;

CREATE POLICY "reminder_templates_select" ON public.reminder_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "reminder_templates_insert" ON public.reminder_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reminder_templates_update" ON public.reminder_templates FOR UPDATE TO authenticated USING (true);

-- Reminder Logs
-- Tracks every reminder sent to ensure we don't spam customers
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_invoice_template ON public.reminder_logs(invoice_id, template_id);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_logs_select" ON public.reminder_logs;
DROP POLICY IF EXISTS "reminder_logs_insert" ON public.reminder_logs;

CREATE POLICY "reminder_logs_select" ON public.reminder_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "reminder_logs_insert" ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Seed Default Templates
INSERT INTO public.reminder_templates (name, days_overdue, channel, subject, body) VALUES
  ('Gentle Reminder (3 Days)', 3, 'whatsapp', NULL, 
   'Namaste {customer_name}, this is a gentle reminder from DairyFlow. Your invoice {invoice_no} for ₹{outstanding} was due on {due_date}. Please arrange payment at your earliest convenience. Thank you!'),
  ('Firm Reminder (7 Days)', 7, 'whatsapp', NULL, 
   'Dear {customer_name}, our records show that invoice {invoice_no} for ₹{outstanding} is now 7 days overdue (due on {due_date}). Please clear the outstanding amount of ₹{outstanding} immediately to avoid service interruption. Regards, DairyFlow.'),
  ('Final Notice (15 Days)', 15, 'whatsapp', NULL, 
   'URGENT: {customer_name}, your payment of ₹{outstanding} for invoice {invoice_no} is 15 days overdue. Please pay immediately to avoid credit hold. If already paid, please ignore this message. DairyFlow Accounts.');

-- Function to check if a reminder was already sent for a specific invoice and threshold
-- This prevents duplicate reminders
CREATE OR REPLACE FUNCTION public.has_reminder_been_sent(_invoice_id UUID, _template_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count 
  FROM public.reminder_logs 
  WHERE invoice_id = _invoice_id 
    AND template_id = _template_id 
    AND status = 'sent';
  RETURN v_count > 0;
END;
$$;
