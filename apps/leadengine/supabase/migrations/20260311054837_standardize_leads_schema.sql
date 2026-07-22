DROP TRIGGER IF EXISTS trg_sync_task_sla ON public.lead_tasks;
DROP TRIGGER IF EXISTS trg_sync_task_sla_insert ON public.lead_tasks;
DROP FUNCTION IF EXISTS public.fn_sync_task_to_lead_sla();

ALTER TABLE public.leads RENAME COLUMN venue_hotel TO event_venue;
ALTER TABLE public.leads RENAME COLUMN location_city TO event_city;
ALTER TABLE public.leads RENAME COLUMN number_of_pax TO pax_count;
ALTER TABLE public.leads RENAME COLUMN date_of_event TO event_date_start;
ALTER TABLE public.leads RENAME COLUMN estimated_revenue TO estimated_value;
ALTER TABLE public.leads RENAME COLUMN main_stream TO stream_type;
ALTER TABLE public.leads RENAME COLUMN source_lead TO lead_source;

ALTER TABLE public.leads ALTER COLUMN event_date_start TYPE date USING event_date_start::date;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_date_end date;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS actual_value numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_format text;

ALTER TABLE public.leads DROP COLUMN IF EXISTS main_company;
ALTER TABLE public.leads DROP COLUMN IF EXISTS company_name;
ALTER TABLE public.leads DROP COLUMN IF EXISTS bu_revenue;
ALTER TABLE public.leads DROP COLUMN IF EXISTS pic_sales;
ALTER TABLE public.leads DROP COLUMN IF EXISTS pic_so;
ALTER TABLE public.leads DROP COLUMN IF EXISTS account_manager;

ALTER TABLE public.leads DROP COLUMN IF EXISTS start_date;
ALTER TABLE public.leads DROP COLUMN IF EXISTS month_event;
ALTER TABLE public.leads DROP COLUMN IF EXISTS year_lead_receive;
ALTER TABLE public.leads DROP COLUMN IF EXISTS month_receive_lead;
ALTER TABLE public.leads DROP COLUMN IF EXISTS date_lead_received;

ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_tep_to_pd;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_pd_to_so;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_pd_to_acs;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_so_to_pd;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_pd_to_tep;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_acs_to_pd;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_quo_to_tep;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_pro_to_tep;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_quo_send_client;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sla_pro_send_client;
ALTER TABLE public.leads DROP COLUMN IF EXISTS duration_inq_to_pd;
ALTER TABLE public.leads DROP COLUMN IF EXISTS duration_inq_to_client;

ALTER TABLE public.leads DROP COLUMN IF EXISTS salutation;
ALTER TABLE public.leads DROP COLUMN IF EXISTS contact_full_name;
ALTER TABLE public.leads DROP COLUMN IF EXISTS contact_email;
ALTER TABLE public.leads DROP COLUMN IF EXISTS contact_mobile;
ALTER TABLE public.leads DROP COLUMN IF EXISTS job_title;
ALTER TABLE public.leads DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.leads DROP COLUMN IF EXISTS address;
ALTER TABLE public.leads DROP COLUMN IF EXISTS office_phone;
ALTER TABLE public.leads DROP COLUMN IF EXISTS destination;
ALTER TABLE public.leads DROP COLUMN IF EXISTS client_province_country;
ALTER TABLE public.leads DROP COLUMN IF EXISTS client_company_country;

ALTER TABLE public.leads DROP COLUMN IF EXISTS nominal_konfirmasi;
ALTER TABLE public.leads DROP COLUMN IF EXISTS materialized_amount;
ALTER TABLE public.leads DROP COLUMN IF EXISTS difference_amount;
ALTER TABLE public.leads DROP COLUMN IF EXISTS percentage_deal;

ALTER TABLE public.leads DROP COLUMN IF EXISTS is_onsite;
ALTER TABLE public.leads DROP COLUMN IF EXISTS is_online;
ALTER TABLE public.leads DROP COLUMN IF EXISTS tipe_stream;

ALTER TABLE public.leads DROP COLUMN IF EXISTS follow_up_1;
ALTER TABLE public.leads DROP COLUMN IF EXISTS follow_up_2;
ALTER TABLE public.leads DROP COLUMN IF EXISTS follow_up_3;
ALTER TABLE public.leads DROP COLUMN IF EXISTS follow_up_4;
ALTER TABLE public.leads DROP COLUMN IF EXISTS follow_up_5;
ALTER TABLE public.leads DROP COLUMN IF EXISTS sign_doc_type;
ALTER TABLE public.leads DROP COLUMN IF EXISTS date_send_doc;
ALTER TABLE public.leads DROP COLUMN IF EXISTS time_log;;
