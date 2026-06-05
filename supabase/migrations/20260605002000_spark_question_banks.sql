create table if not exists "public"."SparkQuestionBank" (
  "id" text not null default gen_random_uuid()::text,
  "postingId" text not null,
  "jobOrderId" text,
  "jdSourceHash" text not null,
  "payloadVersion" text not null default 'spark.question_bank.v1',
  "status" text not null default 'Draft',
  "questionCountTarget" integer not null default 10,
  "generatedBy" text not null default 'ai',
  "generatedAt" timestamp(3) not null default current_timestamp,
  "approvedByUserId" text,
  "approvedAt" timestamp(3),
  "retiredAt" timestamp(3),
  "mcpServerSlug" text,
  "mcpToolName" text,
  "mcpRunId" text,
  "modelName" text,
  "promptVersion" text not null default 'spark-question-bank-v1.0',
  "safetyProfile" text not null default 'same-bank-no-per-candidate-v1',
  "sourceSnapshot" jsonb not null default '{}',
  "questions" jsonb not null default '[]',
  "agentReview" jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SparkQuestionBank_pkey" primary key ("id"),
  constraint "SparkQuestionBank_status_check" check ("status" in ('Draft', 'Approved', 'Retired')),
  constraint "SparkQuestionBank_generatedBy_check" check ("generatedBy" in ('ai', 'mcp', 'recruiter', 'system')),
  constraint "SparkQuestionBank_questionCountTarget_check" check ("questionCountTarget" between 3 and 15)
);

create table if not exists "public"."SparkQuestionBankAuditEvent" (
  "id" text not null default gen_random_uuid()::text,
  "questionBankId" text not null,
  "postingId" text not null,
  "eventType" text not null,
  "actorType" text not null default 'system',
  "actorId" text,
  "beforeJson" jsonb,
  "afterJson" jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "SparkQuestionBankAuditEvent_pkey" primary key ("id")
);

create index if not exists "SparkQuestionBank_postingId_status_idx"
  on "public"."SparkQuestionBank"("postingId", "status");

create index if not exists "SparkQuestionBank_jdSourceHash_idx"
  on "public"."SparkQuestionBank"("jdSourceHash");

create unique index if not exists "SparkQuestionBank_one_approved_per_posting_idx"
  on "public"."SparkQuestionBank"("postingId")
  where "status" = 'Approved';

create index if not exists "SparkQuestionBankAuditEvent_questionBankId_idx"
  on "public"."SparkQuestionBankAuditEvent"("questionBankId", "createdAt");

do $$
begin
  alter table "public"."SparkQuestionBank"
    add constraint "SparkQuestionBank_postingId_fkey"
    foreign key ("postingId") references "public"."SparkJobPosting"("id")
    on delete cascade on update cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table "public"."SparkQuestionBankAuditEvent"
    add constraint "SparkQuestionBankAuditEvent_questionBankId_fkey"
    foreign key ("questionBankId") references "public"."SparkQuestionBank"("id")
    on delete cascade on update cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table "public"."SparkQuestionBankAuditEvent"
    add constraint "SparkQuestionBankAuditEvent_postingId_fkey"
    foreign key ("postingId") references "public"."SparkJobPosting"("id")
    on delete cascade on update cascade;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
