-- Expense tracking for operational costs (fuel, maintenance, salaries, packaging, etc.)
-- Supports category-based expenses and period reporting.

-- Categories: fuel, vehicle maintenance, staff salary, packaging, rent, utilities, other
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#64748b',   -- Tailwind slate-500 default
  icon TEXT,                       -- optional lucide icon name for UI
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual expense records
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT CHECK (payment_mode IN ('cash','upi','bank','credit')),
  receipt_url TEXT,
  reference_no TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category_id);

-- RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON public.expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON public.expense_categories;

CREATE POLICY "expense_categories_select" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_categories_insert" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expense_categories_update" ON public.expense_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "expense_categories_delete" ON public.expense_categories FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated USING (true);

-- Seed default expense categories
INSERT INTO public.expense_categories (name, color, icon) VALUES
  ('Fuel / Transport',       '#ef4444', 'fuel'),
  ('Vehicle Maintenance',    '#f97316', 'wrench'),
  ('Staff Salary',           '#3b82f6', 'users'),
  ('Packaging / Crates',     '#a855f7', 'package'),
  ('Rent',                   '#10b981', 'home'),
  ('Utilities (Electricity)', '#eab308', 'zap'),
  ('Office / Misc',          '#64748b', 'file-text')
ON CONFLICT (name) DO NOTHING;

-- Period totals helper (used by reports page)
-- Returns totals by category for a date range
CREATE OR REPLACE FUNCTION public.expense_totals_by_category(
  _from DATE,
  _to DATE
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  total_amount NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ec.id AS category_id,
    ec.name AS category_name,
    COALESCE(SUM(e.amount), 0) AS total_amount
  FROM public.expense_categories ec
  LEFT JOIN public.expenses e ON e.category_id = ec.id
    AND e.expense_date BETWEEN _from AND _to
  GROUP BY ec.id, ec.name
  ORDER BY total_amount DESC;
$$;

-- Total expenses for a date range
CREATE OR REPLACE FUNCTION public.expense_total(
  _from DATE,
  _to DATE
)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.expenses
  WHERE expense_date BETWEEN _from AND _to;
$$;
