-- PostgREST caches the schema; a column added a moment ago is unknown to
-- the API until it reloads. Ask again, outside any transaction.
NOTIFY pgrst, 'reload schema';
