-- ================================================================
-- PRÁCTICA EMPRENDEDORA · LICENCIAS POR CUENTA
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- ================================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  customer text not null default 'Licencia Práctica Emprendedora',
  plan text not null default 'PE Admin',
  status text not null default 'active' check (status in ('active','paused','revoked')),
  expires_at timestamptz,
  max_devices integer not null default 1 check (max_devices between 1 and 50),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.license_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  installation_id text not null,
  device_name text,
  revoked boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_id, installation_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

-- También crea perfiles para usuarios que ya existían antes de correr este SQL.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

create or replace function public.is_pe_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.licenses enable row level security;
alter table public.license_devices enable row level security;

-- Perfiles
create policy "profile read own or admin" on public.profiles
for select using (id = auth.uid() or public.is_pe_admin());
create policy "profile admin update" on public.profiles
for update using (public.is_pe_admin()) with check (public.is_pe_admin());

-- Licencias: el cliente ve sólo la suya; el admin ve y modifica todas.
create policy "license read own or admin" on public.licenses
for select using (user_id = auth.uid() or public.is_pe_admin());
create policy "license admin insert" on public.licenses
for insert with check (public.is_pe_admin());
create policy "license admin update" on public.licenses
for update using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy "license admin delete" on public.licenses
for delete using (public.is_pe_admin());

-- Dispositivos: cliente puede ver los de su licencia; admin todos.
create policy "device read own or admin" on public.license_devices
for select using (
  public.is_pe_admin() or exists (
    select 1 from public.licenses l
    where l.id = license_id and l.user_id = auth.uid()
  )
);
create policy "device admin update" on public.license_devices
for update using (public.is_pe_admin()) with check (public.is_pe_admin());
create policy "device admin delete" on public.license_devices
for delete using (public.is_pe_admin());

-- Registra/reutiliza un equipo respetando max_devices.
create or replace function public.pe_register_device(
  p_installation_id text,
  p_device_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  dev public.license_devices%rowtype;
  active_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('valid', false, 'message', 'Sesión no válida.');
  end if;

  select * into lic from public.licenses where user_id = auth.uid();
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Tu cuenta no tiene una licencia asignada.');
  end if;
  if lic.status <> 'active' then
    return jsonb_build_object('valid', false, 'message', 'La licencia no está activa.');
  end if;
  if lic.expires_at is not null and now() > lic.expires_at then
    return jsonb_build_object('valid', false, 'message', 'La licencia está vencida.');
  end if;

  select * into dev from public.license_devices
  where license_id = lic.id and installation_id = p_installation_id;

  if found then
    if dev.revoked then
      return jsonb_build_object('valid', false, 'message', 'Este dispositivo fue revocado.');
    end if;
    update public.license_devices
      set last_seen_at = now(), device_name = coalesce(p_device_name, device_name)
      where id = dev.id;
  else
    select count(*) into active_count from public.license_devices
    where license_id = lic.id and revoked = false;
    if active_count >= lic.max_devices then
      return jsonb_build_object(
        'valid', false,
        'message', 'La licencia alcanzó el máximo de dispositivos. Revocá uno desde la web.'
      );
    end if;
    insert into public.license_devices(license_id, installation_id, device_name)
    values (lic.id, p_installation_id, p_device_name);
  end if;

  return jsonb_build_object(
    'valid', true,
    'message', 'Licencia válida y activa.',
    'license', jsonb_build_object(
      'id', lic.id,
      'customer', lic.customer,
      'plan', lic.plan,
      'status', lic.status,
      'expires_at', lic.expires_at,
      'max_devices', lic.max_devices
    )
  );
end;
$$;

create or replace function public.pe_validate_device(p_installation_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.licenses%rowtype;
  dev public.license_devices%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('valid', false, 'message', 'Sesión no válida.');
  end if;
  select * into lic from public.licenses where user_id = auth.uid();
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Tu cuenta no tiene una licencia asignada.');
  end if;
  if lic.status <> 'active' then
    return jsonb_build_object('valid', false, 'message', 'La licencia no está activa.');
  end if;
  if lic.expires_at is not null and now() > lic.expires_at then
    return jsonb_build_object('valid', false, 'message', 'La licencia está vencida.');
  end if;
  select * into dev from public.license_devices
  where license_id = lic.id and installation_id = p_installation_id;
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Este equipo todavía no está activado para la cuenta.');
  end if;
  if dev.revoked then
    return jsonb_build_object('valid', false, 'message', 'Este dispositivo fue revocado.');
  end if;
  update public.license_devices set last_seen_at = now() where id = dev.id;
  return jsonb_build_object(
    'valid', true,
    'message', 'Licencia válida y activa.',
    'license', jsonb_build_object(
      'id', lic.id,
      'customer', lic.customer,
      'plan', lic.plan,
      'status', lic.status,
      'expires_at', lic.expires_at,
      'max_devices', lic.max_devices
    )
  );
end;
$$;

grant execute on function public.pe_register_device(text,text) to authenticated;
grant execute on function public.pe_validate_device(text) to authenticated;

-- ================================================================
-- DESPUÉS DE CREAR TU PROPIA CUENTA, convertite en admin con:
-- update public.profiles set role='admin' where email='TU_MAIL';
-- ================================================================
