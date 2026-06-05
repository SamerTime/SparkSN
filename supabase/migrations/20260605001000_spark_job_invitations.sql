create table if not exists "public"."SparkJobInvitation" (
  "id" text not null default gen_random_uuid()::text,
  "postingId" text not null,
  "email" text not null,
  "inviteUrl" text not null,
  "status" text not null default 'Sent',
  "invitedBy" text,
  "communicationState" jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkJobInvitation_pkey" primary key ("id")
);

create unique index if not exists "SparkJobInvitation_postingId_email_key"
  on "public"."SparkJobInvitation"("postingId", "email");

create index if not exists "SparkJobInvitation_email_idx"
  on "public"."SparkJobInvitation"("email");

do $$
begin
  alter table "public"."SparkJobInvitation"
    add constraint "SparkJobInvitation_postingId_fkey"
    foreign key ("postingId") references "public"."SparkJobPosting"("id")
    on delete cascade on update cascade;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
