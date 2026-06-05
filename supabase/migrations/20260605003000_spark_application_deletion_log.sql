create table if not exists "public"."SparkApplicationDeletionLog" (
  "id" text not null default gen_random_uuid()::text,
  "applicationId" text not null,
  "postingId" text,
  "candidateId" text,
  "candidateEmail" text,
  "candidateName" text,
  "applicationStatus" text,
  "note" text not null,
  "deletedByUserId" text,
  "deletedByEmail" text,
  "snapshot" jsonb not null default '{}',
  "deletedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkApplicationDeletionLog_pkey" primary key ("id")
);

create index if not exists "SparkApplicationDeletionLog_applicationId_idx"
  on "public"."SparkApplicationDeletionLog"("applicationId");

create index if not exists "SparkApplicationDeletionLog_postingId_deletedAt_idx"
  on "public"."SparkApplicationDeletionLog"("postingId", "deletedAt");

create index if not exists "SparkApplicationDeletionLog_candidateEmail_idx"
  on "public"."SparkApplicationDeletionLog"("candidateEmail");

notify pgrst, 'reload schema';
