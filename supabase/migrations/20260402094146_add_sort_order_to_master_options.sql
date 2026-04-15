ALTER TABLE master_options ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
COMMENT ON COLUMN master_options.sort_order IS 'Manual sort ordering for taxonomy items';
NOTIFY pgrst, 'reload schema';;
