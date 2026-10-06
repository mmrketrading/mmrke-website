-- Existing v1 installations only. New installations use setup.sql.
alter table public.service_bookings add column if not exists preferred_payment_method text not null default 'PayPal';
alter table public.service_bookings add column if not exists payment_provider text;
alter table public.service_bookings add column if not exists pesapal_tracking_id text unique;
alter table public.service_bookings add column if not exists pesapal_redirect_url text;
alter table public.service_bookings add column if not exists pesapal_confirmation text;
drop function if exists public.submit_service_booking(text,text,text,text,date,text);
create or replace function public.submit_service_booking(p_name text,p_email text,p_phone text,p_service text,p_date date,p_details text,p_payment_method text default 'PayPal')
returns jsonb language plpgsql security definer set search_path='' as $$
declare new_key uuid;
begin
 if length(trim(p_name)) not between 1 and 150 or p_name is null
 or length(p_email) not between 3 and 200 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_email is null
 or length(trim(p_phone)) not between 1 and 40 or p_phone is null
 or length(trim(p_details)) not between 1 and 3000 or p_details is null
 or p_date is null or p_date < (now() at time zone 'Africa/Kampala')::date
 or p_payment_method not in ('Mobile Money','Card','PayPal') or p_payment_method is null
 or p_service is null or p_service not in ('Web Development','Digital Marketing','Advertising & Marketing','Market Research','Public Opinion Polling','Professional & Technical Services')
 then raise exception 'Invalid booking details'; end if;
 insert into public.service_bookings(full_name,email,phone,service,preferred_date,details,preferred_payment_method)
 values(trim(p_name),trim(p_email),trim(p_phone),p_service,p_date,trim(p_details),p_payment_method) returning booking_key into new_key;
 return jsonb_build_object('booking_key',new_key);
end; $$;
revoke all on function public.submit_service_booking(text,text,text,text,date,text,text) from public;
grant execute on function public.submit_service_booking(text,text,text,text,date,text,text) to anon, authenticated;

create or replace function public.protect_booking_quote() returns trigger language plpgsql set search_path='' as $$
begin
 if old.payment_provider is not null and (new.quote_amount is distinct from old.quote_amount or new.currency is distinct from old.currency) then
 raise exception 'Quote locked because checkout has started'; end if;
 return new;
end; $$;
