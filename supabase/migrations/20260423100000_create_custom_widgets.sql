-- Custom dashboard widgets (per-user, personal)
CREATE TABLE IF NOT EXISTS public.custom_widgets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES public.companies(id),
  title         text NOT NULL,
  widget_type   text NOT NULL CHECK (widget_type IN ('kpi','bar','pie','list')),
  metric_field  text NOT NULL,
  aggregation   text NOT NULL CHECK (aggregation IN ('count','sum','avg')),
  group_by      text,
  config        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.custom_widgets ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own widgets
CREATE POLICY "custom_widgets_owner" ON public.custom_widgets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_update_custom_widgets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_widgets_updated_at ON public.custom_widgets;
CREATE TRIGGER trg_custom_widgets_updated_at
  BEFORE UPDATE ON public.custom_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_custom_widgets_timestamp();
