-- Treat upstream Spark posting identity as a composite of source system,
-- entity type, and entity id. A job_order and job_description may legally
-- share a sourceEntityId, but must never update/relabel each other.
drop index if exists "public"."SparkJobPosting_sourceEntityId_key";
drop index if exists "SparkJobPosting_sourceEntityId_key";

create unique index if not exists "SparkJobPosting_source_identity_key"
  on "public"."SparkJobPosting"("sourceSystem", "sourceEntityType", "sourceEntityId");
