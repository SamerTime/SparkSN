-- Singleton admin settings for Spark (e.g. auto-accept by email domain).
-- Roles/permissions will eventually be inherited from staffingnation.us; this is
-- a lightweight "for now" store. Accessed server-side via the service role.
create table if not exists "public"."SparkSetting" (
  "id" text not null default 'singleton',
  "autoAcceptEnabled" boolean not null default false,
  "autoAcceptDomains" jsonb not null default '[]',
  "updatedByEmail" text,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkSetting_pkey" primary key ("id"),
  constraint "SparkSetting_singleton" check ("id" = 'singleton')
);

-- Seed the singleton row: auto-accept OFF by default, tcwglobal.com pre-listed.
insert into "public"."SparkSetting" ("id", "autoAcceptEnabled", "autoAcceptDomains")
values ('singleton', false, '["tcwglobal.com"]'::jsonb)
on conflict ("id") do nothing;

notify pgrst, 'reload schema';
