-- SQL Migration: Recreate Billing & Finance Module Tables with Auditing

-- Drop existing tables to ensure they are recreated with the new created_by columns
DROP TABLE IF EXISTS public.finance_settlements CASCADE;
DROP TABLE IF EXISTS public.finance_collections CASCADE;
DROP TABLE IF EXISTS public.finance_expenses CASCADE;
DROP TABLE IF EXISTS public.finance_reserves CASCADE;

-- Create Expenses Table
CREATE TABLE public.finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by VARCHAR(100) NOT NULL DEFAULT 'Company', -- 'Company', 'Sathish', 'Sankar', 'Nipin'
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Reserves Table
CREATE TABLE public.finance_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  held_by VARCHAR(100) NOT NULL, -- 'Sathish', 'Sankar', 'Nipin', 'Company'
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Collections Table
CREATE TABLE public.finance_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Collected'
  billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_shop_billing_date UNIQUE (shop_id, billing_date)
);

-- Create Settlements Table (Partner payouts)
CREATE TABLE public.finance_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name VARCHAR(100) NOT NULL, -- 'Sathish', 'Sankar', 'Nipin'
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security safely
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_settlements ENABLE ROW LEVEL SECURITY;

-- Safely recreate policies
DROP POLICY IF EXISTS "Allow authenticated access to expenses" ON public.finance_expenses;
CREATE POLICY "Allow authenticated access to expenses" ON public.finance_expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to reserves" ON public.finance_reserves;
CREATE POLICY "Allow authenticated access to reserves" ON public.finance_reserves
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to collections" ON public.finance_collections;
CREATE POLICY "Allow authenticated access to collections" ON public.finance_collections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated access to settlements" ON public.finance_settlements;
CREATE POLICY "Allow authenticated access to settlements" ON public.finance_settlements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
