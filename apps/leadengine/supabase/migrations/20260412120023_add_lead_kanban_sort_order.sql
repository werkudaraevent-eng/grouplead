ALTER TABLE leads ADD COLUMN IF NOT EXISTS kanban_sort_order numeric DEFAULT extract(epoch from now());;
