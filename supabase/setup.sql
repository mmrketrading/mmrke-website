-- Run once in your Supabase SQL Editor. Bookings are private.
create table public.service_bookings (
 id uuid primary key default gen_random_uuid(),
 booking_key uuid unique not null default gen_random_uuid(),
 full_name text not null, email text not null, phone text not null,
 service text not null, preferred_date date not null, details text not null,
 status text not null default 'awaiting_quote' check(status in ('awaiting_quote','quoted','paid','cancelled')),
 quote_amount numeric(12,2) check(quote_amount > 0), currency text not null default 'USD' check(currency='USD'),
 preferred_payment_method text not null default 'PayPal',
 payment_provider text, pesapal_tracking_id text unique, pesapal_redirect_url text, pesapal_confirmation text,
 paypal_order_id text unique, paypal_capture_id text unique,
 created_at timestamptz not null default now(), paid_at timestamptz
);
alter table public.service_bookings enable row level security;
revoke all on public.service_bookings from anon, authenticated;
create function public.submit_service_booking(p_name text,p_email text,p_phone text,p_service text,p_date date,p_details text,p_payment_method text default 'PayPal')
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
-- Approve a quote in Table Editor: set quote_amount in USD and status to quoted.
-- Never modify a quote after paypal_order_id has been set.
create function public.protect_booking_quote() returns trigger language plpgsql set search_path='' as $$
begin
 if old.payment_provider is not null and (new.quote_amount is distinct from old.quote_amount or new.currency is distinct from old.currency) then
 raise exception 'Quote locked because checkout has started'; end if;
 return new;
end; $$;
create trigger protect_booking_quote before update on public.service_bookings for each row execute function public.protect_booking_quote();
