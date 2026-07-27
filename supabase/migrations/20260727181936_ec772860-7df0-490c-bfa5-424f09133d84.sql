ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'retailer';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retailer_code text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS assigned_route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_key ON public.customers(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_retailer_code_key ON public.customers(retailer_code) WHERE retailer_code IS NOT NULL;

DROP POLICY IF EXISTS "Retailer can view own customer row" ON public.customers;
CREATE POLICY "Retailer can view own customer row"
ON public.customers FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.retailer_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('opening_balance','invoice','payment','credit_note','adjustment')),
  debit_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  running_balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retailer_ledger_entries_retailer_idx ON public.retailer_ledger_entries(retailer_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailer_ledger_entries TO authenticated;
GRANT ALL ON public.retailer_ledger_entries TO service_role;

ALTER TABLE public.retailer_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ledger entries"
ON public.retailer_ledger_entries FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Retailer can view own ledger entries"
ON public.retailer_ledger_entries FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = retailer_id AND c.user_id = auth.uid()));

CREATE POLICY "Finance can insert ledger entries"
ON public.retailer_ledger_entries FOR INSERT TO authenticated
WITH CHECK (public.can_manage_finance(auth.uid()));

CREATE POLICY "Finance can update ledger entries"
ON public.retailer_ledger_entries FOR UPDATE TO authenticated
USING (public.can_manage_finance(auth.uid()))
WITH CHECK (public.can_manage_finance(auth.uid()));

CREATE POLICY "Finance can delete ledger entries"
ON public.retailer_ledger_entries FOR DELETE TO authenticated
USING (public.can_manage_finance(auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at_retailer_ledger_entries ON public.retailer_ledger_entries;
CREATE TRIGGER set_updated_at_retailer_ledger_entries
BEFORE UPDATE ON public.retailer_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();