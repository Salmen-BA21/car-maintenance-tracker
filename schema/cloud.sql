-- PostgreSQL (Supabase) cloud schema, extracted verbatim from 06-database/07-database-design/03-physical-settings.md (section 5.2).
-- Authoritative for the cloud. Apply parts in order.

-- ===== part 1 =====
create sequence sync_seq_seq;

create table users (
  id               text primary key,            -- auth.uid()::text
  email            text not null,
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text not null,
  sync_seq         bigint not null default 0
);

create table user_settings (
  user_id          text primary key references users(id) deferrable initially deferred,
  reminder_enabled smallint not null default 1 check (reminder_enabled in (0,1)),
  reminder_time    text not null default '20:00'
                   check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  currency_code    text not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text not null,
  sync_seq         bigint not null default 0
);

create table cars (
  id               text primary key,
  user_id          text not null references users(id) deferrable initially deferred,
  name             text not null check (length(btrim(name)) between 1 and 60),
  fuel_type        text not null check (fuel_type in ('petrol','diesel')),
  timing_drive     text not null check (timing_drive in ('belt','chain')),
  gearbox          text not null check (gearbox in ('manual','automatic')),
  has_dpf          smallint not null default 0 check (has_dpf in (0,1)),
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text not null,
  sync_seq         bigint not null default 0,
  unique (id, user_id),
  check (fuel_type = 'diesel' or has_dpf = 0)
);

create table categories (
  id               text primary key,
  user_id          text references users(id) deferrable initially deferred,
  code             text not null,
  name             text not null,
  sort_order       integer not null,
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text,
  sync_seq         bigint not null default 0,
  check ((user_id is null) = (origin_device_id is null)),
  check (user_id is not null or id = code),
  check (user_id is not null or deleted_at is null)
);

create table part_templates (
  code              text primary key,
  category_id       text not null references categories(id) deferrable initially deferred,
  name              text not null,
  fuel_type         text check (fuel_type in ('petrol','diesel')),
  timing_drive      text check (timing_drive in ('belt','chain')),
  requires_dpf      smallint not null default 0 check (requires_dpf in (0,1)),
  interval_type     text not null check (interval_type in ('distance','time','both','condition')),
  distance_km       integer check (distance_km > 0),
  months            integer check (months > 0),
  inspection_months integer check (inspection_months between 1 and 60),
  sort_order        integer not null,
  template_version  integer not null,
  retired_at        text,
  check (
    (interval_type = 'distance'  and months is null) or
    (interval_type = 'time'      and distance_km is null) or
    (interval_type = 'both') or
    (interval_type = 'condition' and distance_km is null and months is null
                                 and inspection_months is not null)
  ),
  check (interval_type = 'condition' or inspection_months is null)
);

create table parts (
  id                   text primary key,
  user_id              text not null references users(id) deferrable initially deferred,
  car_id               text not null references cars(id, user_id) deferrable initially deferred,
  category_id          text not null references categories(id) deferrable initially deferred,
  template_code        text references part_templates(code) deferrable initially deferred,
  name                 text not null,
  interval_type        text not null check (interval_type in ('distance','time','both','condition')),
  distance_km          integer check (distance_km between 1 and 9999999),
  months               integer check (months between 1 and 240),
  inspection_months    integer check (inspection_months between 1 and 60),
  include_in_reminders smallint not null default 1 check (include_in_reminders in (0,1)),
  hidden_by            text check (hidden_by in ('user','profile')),
  sort_order           integer not null default 0,
  created_at           text not null,
  updated_at           text not null,
  deleted_at           text,
  origin_device_id     text not null,
  sync_seq             bigint not null default 0,
  unique (id, user_id),
  check (template_code is null or id = car_id || ':' || template_code),
  check (interval_type <> 'distance'  or months is null),
  check (interval_type <> 'time'      or distance_km is null),
  check (interval_type <> 'condition' or (inspection_months is not null
                                          and distance_km is null
                                          and months is null)),
  check (interval_type = 'condition' or inspection_months is null),
  check (hidden_by is null or template_code is not null)
);

create table odometer_entries (
  id               text primary key,
  user_id          text not null references users(id) deferrable initially deferred,
  car_id           text not null references cars(id, user_id) deferrable initially deferred,
  value_km         integer not null check (value_km between 0 and 9999999),
  entry_date       date not null,
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text not null,
  sync_seq         bigint not null default 0
);

create table service_records (
  id               text primary key,
  user_id          text not null references users(id) deferrable initially deferred,
  car_id           text not null references cars(id, user_id) deferrable initially deferred,
  part_id          text not null references parts(id, user_id) deferrable initially deferred,
  kind             text not null default 'service' check (kind in ('service','inspection')),
  service_km       integer check (service_km between 0 and 9999999),
  service_date     date,
  is_baseline      smallint not null default 0 check (is_baseline in (0,1)),
  cost_minor       integer check (cost_minor >= 0),
  cost_currency    text check (cost_currency ~ '^[A-Z]{3}$'),
  notes            text,
  created_at       text not null,
  updated_at       text not null,
  deleted_at       text,
  origin_device_id text not null,
  sync_seq         bigint not null default 0,
  check (cost_minor is null or cost_currency is not null),
  check (cost_minor is null or kind = 'service'),
  check (is_baseline = 0 or kind = 'service'),
  check (kind <> 'inspection' or (service_date is not null and service_km is null)),
  check (kind <> 'service' or is_baseline = 1
         or (service_km is not null and service_date is not null)),
  check (kind <> 'service' or is_baseline = 0
         or service_km is not null or service_date is not null)
);

create table schema_migrations (
  version    integer primary key,
  applied_at timestamptz not null default now()
);

-- ===== part 2 =====
create index cars_sync_seq             on cars             (user_id, sync_seq);
create index user_settings_sync_seq    on user_settings    (user_id, sync_seq);
create index parts_sync_seq            on parts            (user_id, sync_seq);
create index odometer_entries_sync_seq on odometer_entries (user_id, sync_seq);
create index service_records_sync_seq  on service_records  (user_id, sync_seq);
create index categories_sync_seq       on categories       (user_id, sync_seq) where user_id is not null;
create index users_sync_seq            on users            (sync_seq);

-- ===== part 3 =====
alter table users            enable row level security;
alter table user_settings    enable row level security;
alter table cars             enable row level security;
alter table categories       enable row level security;
alter table part_templates   enable row level security;
alter table parts            enable row level security;
alter table odometer_entries enable row level security;
alter table service_records  enable row level security;

create policy users_select on users for select to authenticated
  using (id = auth.uid()::text);
create policy user_settings_select on user_settings for select to authenticated
  using (user_id = auth.uid()::text);
create policy cars_select on cars for select to authenticated
  using (user_id = auth.uid()::text);
create policy parts_select on parts for select to authenticated
  using (user_id = auth.uid()::text);
create policy odometer_entries_select on odometer_entries for select to authenticated
  using (user_id = auth.uid()::text);
create policy service_records_select on service_records for select to authenticated
  using (user_id = auth.uid()::text);
create policy categories_select on categories for select to authenticated
  using (user_id is null or user_id = auth.uid()::text);
create policy part_templates_select on part_templates for select to authenticated
  using (true);

revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant select on users, user_settings, cars, categories, part_templates,
                parts, odometer_entries, service_records, schema_migrations
  to authenticated;

-- ===== part 4 =====
insert into parts (id, user_id, /* ... */ updated_at, origin_device_id, sync_seq)
values (?, ?, /* ... */ ?, ?, nextval('sync_seq_seq'))
on conflict (id) do update set /* all columns = excluded.* */,
      sync_seq = nextval('sync_seq_seq')
where excluded.updated_at > parts.updated_at
   or (excluded.updated_at = parts.updated_at
       and excluded.origin_device_id > parts.origin_device_id)
returning id;
