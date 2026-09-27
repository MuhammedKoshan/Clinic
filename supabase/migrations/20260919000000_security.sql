-- Run this migration in the Supabase SQL Editor.
-- Assign app_metadata.role = 'doctor' to the trusted doctor account separately.

create unique index if not exists appointments_date_time_unique
on public.appointments (appointment_date, appointment_time);

alter table public.appointments
	drop constraint if exists appointments_name_length,
	drop constraint if exists appointments_email_length,
	drop constraint if exists appointments_phone_format,
	drop constraint if exists appointments_time_allowed,
	drop constraint if exists appointments_message_length;

alter table public.appointments
	add constraint appointments_name_length check (char_length(trim(name)) between 5 and 100) not valid,
	add constraint appointments_email_length check (char_length(trim(email)) between 3 and 254) not valid,
	add constraint appointments_phone_format check (phone ~ '^(90[0-9]{10}|0[0-9]{10}|[1-9][0-9]{9})$') not valid,
	add constraint appointments_time_allowed check (appointment_time in ('09:00', '10:00', '11:00', '14:00', '15:00')) not valid,
	add constraint appointments_message_length check (message is null or char_length(message) <= 1000) not valid;

alter table public.appointments enable row level security;
alter table public.doctor_availability enable row level security;

revoke all on public.appointments from anon;
revoke all on public.doctor_availability from anon;
grant insert (name, email, phone, appointment_date, appointment_time, message)
on public.appointments to anon;
grant delete on public.appointments to authenticated;
grant select (available_date, is_available)
on public.doctor_availability to anon;

drop policy if exists "Public can create new appointments" on public.appointments;
create policy "Public can create new appointments"
on public.appointments
for insert
to anon
with check (
	status is null or status = 'new'
);

drop policy if exists "Public can view availability" on public.doctor_availability;
create policy "Public can view availability"
on public.doctor_availability
for select
to anon
using (true);

drop policy if exists "Doctor can read appointments" on public.appointments;
create policy "Doctor can read appointments"
on public.appointments
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');

drop policy if exists "Doctor can update appointments" on public.appointments;
create policy "Doctor can update appointments"
on public.appointments
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');

drop policy if exists "Doctor can delete appointments" on public.appointments;
create policy "Doctor can delete appointments"
on public.appointments
for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');

drop policy if exists "Doctor can read availability" on public.doctor_availability;
create policy "Doctor can read availability"
on public.doctor_availability
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');

drop policy if exists "Doctor can insert availability" on public.doctor_availability;
create policy "Doctor can insert availability"
on public.doctor_availability
for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');

drop policy if exists "Doctor can update availability" on public.doctor_availability;
create policy "Doctor can update availability"
on public.doctor_availability
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'doctor');
