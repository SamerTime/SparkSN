create extension if not exists "pgcrypto";

do $$
begin
  create type "public"."SparkPostingStatus" as enum ('Published', 'Archived', 'Closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type "public"."SparkApplicationStatus" as enum (
    'ProfileStarted',
    'Applied',
    'RecruiterApproved',
    'InterviewInvited',
    'InterviewStarted',
    'InterviewCompleted',
    'RecruiterReview',
    'Vetted',
    'Declined'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists "public"."SparkJobPosting" (
  "id" text not null default gen_random_uuid()::text,
  "sourceSystem" text not null default 'staffingnation',
  "sourceEntityType" text not null default 'job_description',
  "sourceEntityId" text not null,
  "sourceRevision" text,
  "payloadVersion" text not null,
  "clientId" text not null,
  "clientName" text,
  "title" text not null,
  "slug" text not null,
  "overview" text,
  "responsibilities" text,
  "requirements" text,
  "qualifications" text,
  "skills" text[] not null default array[]::text[],
  "certifications" text[] not null default array[]::text[],
  "physicalRequirements" jsonb not null default '{}',
  "payRangeMin" numeric(65,30),
  "payRangeMax" numeric(65,30),
  "currency" text not null default 'USD',
  "country" jsonb,
  "socCode" text,
  "socTitle" text,
  "wcCode" text,
  "wcDescription" text,
  "publicJobsBaseUrl" text not null default 'https://tcwtable.com/jobs',
  "publicUrl" text,
  "status" "public"."SparkPostingStatus" not null default 'Published',
  "rawPayload" jsonb not null,
  "publishedAt" timestamp(3) not null default current_timestamp,
  "lastSyncedAt" timestamp(3) not null default current_timestamp,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkJobPosting_pkey" primary key ("id")
);

create table if not exists "public"."SparkCandidateProfile" (
  "id" text not null default gen_random_uuid()::text,
  "email" text not null,
  "firstName" text,
  "lastName" text,
  "phone" text,
  "city" text,
  "state" text,
  "country" text,
  "resumeUrl" text,
  "profileData" jsonb not null default '{}',
  "geolocationConsentAt" timestamp(3),
  "aiInterviewConsentAt" timestamp(3),
  "recordingConsentAt" timestamp(3),
  "fraudReviewData" jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkCandidateProfile_pkey" primary key ("id")
);

create table if not exists "public"."SparkApplication" (
  "id" text not null default gen_random_uuid()::text,
  "postingId" text not null,
  "candidateId" text,
  "candidateEmail" text,
  "candidateName" text,
  "candidatePhone" text,
  "status" "public"."SparkApplicationStatus" not null default 'ProfileStarted',
  "recruiterNotes" text,
  "communicationState" jsonb not null default '{}',
  "deviceSignals" jsonb not null default '{}',
  "locationSignals" jsonb not null default '{}',
  "interviewMedia" jsonb not null default '{}',
  "interviewTranscript" jsonb not null default '{}',
  "aiSummary" jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkApplication_pkey" primary key ("id")
);

create unique index if not exists "SparkJobPosting_sourceEntityId_key"
  on "public"."SparkJobPosting"("sourceEntityId");

create unique index if not exists "SparkJobPosting_slug_key"
  on "public"."SparkJobPosting"("slug");

create unique index if not exists "SparkCandidateProfile_email_key"
  on "public"."SparkCandidateProfile"("email");

create index if not exists "SparkApplication_postingId_status_idx"
  on "public"."SparkApplication"("postingId", "status");

create index if not exists "SparkApplication_candidateEmail_idx"
  on "public"."SparkApplication"("candidateEmail");

do $$
begin
  alter table "public"."SparkApplication"
    add constraint "SparkApplication_postingId_fkey"
    foreign key ("postingId") references "public"."SparkJobPosting"("id")
    on delete restrict on update cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table "public"."SparkApplication"
    add constraint "SparkApplication_candidateId_fkey"
    foreign key ("candidateId") references "public"."SparkCandidateProfile"("id")
    on delete set null on update cascade;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
