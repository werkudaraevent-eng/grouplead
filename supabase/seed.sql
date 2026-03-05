
-- Seed data for master_options

-- BU Revenue Options
INSERT INTO public.master_options (option_type, label, value) VALUES
('bu_revenue', 'WNW', 'WNW'),
('bu_revenue', 'WNS', 'WNS'),
('bu_revenue', 'UK', 'UK');

-- Status Options
INSERT INTO public.master_options (option_type, label, value) VALUES
('status', 'Lead Masuk', 'Lead Masuk'),
('status', 'Estimasi Project', 'Estimasi Project'),
('status', 'Deal', 'Deal'),
('status', 'Lost', 'Lost');

-- Category Options (Inferred generic categories)
INSERT INTO public.master_options (option_type, label, value) VALUES
('category', 'Corporate Event', 'Corporate Event'),
('category', 'Government', 'Government'),
('category', 'Wedding', 'Wedding'),
('category', 'Social Event', 'Social Event');
