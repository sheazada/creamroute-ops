-- Fix distributors table to match new schema
-- This adds any missing columns to the existing distributors table

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add phone column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN phone TEXT;
  END IF;

  -- Add city column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN city TEXT;
  END IF;

  -- Add state column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'state'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN state TEXT;
  END IF;

  -- Add pincode column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN pincode TEXT;
  END IF;

  -- Add logo_url column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN logo_url TEXT;
  END IF;

  -- Add invoice_prefix column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'invoice_prefix'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN invoice_prefix TEXT DEFAULT 'INV';
  END IF;

  -- Add financial_year_start column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'financial_year_start'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN financial_year_start DATE DEFAULT '2024-04-01';
  END IF;

  -- Add currency column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distributors' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.distributors ADD COLUMN currency TEXT DEFAULT 'INR';
  END IF;

END;
$$;

-- Now update or insert the default distributor with all available columns
INSERT INTO public.distributors (business_name, email, status)
VALUES ('Your Dairy Business', 'admin@creamroute.com', 'active')
ON CONFLICT DO NOTHING;

-- Update the distributor with additional info if it exists
UPDATE public.distributors 
SET phone = '+91-XXXXXXXXXX',
    city = 'Your City',
    state = 'Your State',
    pincode = '000000'
WHERE business_name = 'Your Dairy Business';
