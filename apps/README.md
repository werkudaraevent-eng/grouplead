# Applications

- `leadengine` — existing CRM application.
- `sales-mission` — future mission scheduling and reporting application.

Both applications use the shared Supabase project for authentication. Sales Mission keeps its business tables and RLS policies separate by domain and tenant scope.
