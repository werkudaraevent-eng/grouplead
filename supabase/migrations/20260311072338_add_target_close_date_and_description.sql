-- Add target_close_date and description columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS target_close_date date,
  ADD COLUMN IF NOT EXISTS description text;;
